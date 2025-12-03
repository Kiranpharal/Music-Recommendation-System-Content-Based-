from __future__ import annotations
import os, ast, json, hashlib, asyncio, httpx, zipfile, re
from pathlib import Path
from urllib.parse import quote

import numpy as np
import pandas as pd
from difflib import get_close_matches
from joblib import Memory, dump, load
from bs4 import BeautifulSoup
from sklearn.neighbors import NearestNeighbors

from .utils import MyMinMaxScaler, kmeans_mini_batch

# -------------------------------------------------
# Directories
# -------------------------------------------------
BASE_DIR = Path(__file__).parent
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)

memory = Memory(str(CACHE_DIR), verbose=0)

# -------------------------------------------------
# Dataset from GitHub Release
# -------------------------------------------------
DATA_URL = "https://github.com/Kiranpharal/Music-Recommendation-System-Content-Based-/releases/download/v1-dataset/master_tracks.zip"
ZIP_PATH = Path("/tmp/master_tracks.zip")
CSV_PATH = Path("/tmp/master_tracks.csv")

async def ensure_dataset_downloaded():
    """Download and extract dataset into /tmp if missing."""
    if CSV_PATH.exists():
        print("✔ CSV already available in /tmp")
        return

    print("📥 Downloading dataset ZIP from GitHub Release...")
    async with httpx.AsyncClient() as client:
        resp = await client.get(DATA_URL, timeout=120)
        resp.raise_for_status()
        ZIP_PATH.write_bytes(resp.content)

    print("📦 Extracting ZIP...")
    with zipfile.ZipFile(ZIP_PATH, "r") as z:
        z.extractall("/tmp")

    print("✔ Dataset ready at", CSV_PATH)


# -------------------------------------------------
# Load + Clean Data
# -------------------------------------------------
@memory.cache
def load_and_clean_data() -> pd.DataFrame:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found at {CSV_PATH}")

    print("📄 Loading CSV:", CSV_PATH)
    df = pd.read_csv(CSV_PATH)

    def clean_artists(val: str) -> str:
        if pd.isna(val):
            return ""
        try:
            artists = ast.literal_eval(val)
            return ", ".join(artists) if isinstance(artists, list) else str(val)
        except:
            return str(val)

    df["artists"] = df["artists"].apply(clean_artists)
    df = df.drop_duplicates(subset=["name", "artists"]).dropna(subset=["name"])
    df.fillna(0, inplace=True)
    df.reset_index(drop=True, inplace=True)

    print("✔ Loaded", len(df), "tracks")
    return df


# -------------------------------------------------
# Prepare features, clustering, neighbors
# -------------------------------------------------
AUDIO_FEATS = [
    "danceability", "energy", "key", "loudness", "mode",
    "speechiness", "acousticness", "instrumentalness",
    "liveness", "valence", "tempo", "duration_ms"
]

FEATURE_EMOTION_MAP = {
    "energy": "Energetic",
    "danceability": "Energetic",
    "valence": "Happy",
    "acousticness": "Relaxed",
    "instrumentalness": "Calm",
    "liveness": "Live",
    "speechiness": "Talky"
}
FEATURES_FOR_EMOTION = list(FEATURE_EMOTION_MAP.keys())


# Load data
df = load_and_clean_data()


# -------------------------------------------------
# Scale features
# -------------------------------------------------
SCALER_PATH = CACHE_DIR / "scaler.joblib"
if SCALER_PATH.exists():
    scaler = load(SCALER_PATH)
    X_scaled = scaler.transform(df[AUDIO_FEATS])
else:
    scaler = MyMinMaxScaler()
    X_scaled = scaler.fit_transform(df[AUDIO_FEATS])
    dump(scaler, SCALER_PATH)


# -------------------------------------------------
# Clustering
# -------------------------------------------------
NUM_CLUSTERS = 150
LABEL_PATH = CACHE_DIR / "labels.npy"

def cluster_data(X):
    labels, _ = kmeans_mini_batch(X, k=NUM_CLUSTERS, batch_size=50000, max_iter=200)
    np.save(LABEL_PATH, labels)
    return labels

if LABEL_PATH.exists():
    labels = np.load(LABEL_PATH)
    if len(labels) != len(df):
        labels = cluster_data(X_scaled)
else:
    labels = cluster_data(X_scaled)

df["cluster"] = labels
final_data = df.copy()


# -------------------------------------------------
# Moods
# -------------------------------------------------
def auto_label_emotion(cluster_df: pd.DataFrame):
    means = cluster_df[FEATURES_FOR_EMOTION].mean()
    if means.max() - means.min() == 0:
        return "Medium Neutral"

    means_norm = (means - means.min()) / (means.max() - means.min())
    top_feat = means_norm.idxmax()
    val = means_norm[top_feat]

    intensity = "Low" if val < 0.33 else "Medium" if val < 0.66 else "High"
    mood = FEATURE_EMOTION_MAP.get(top_feat, top_feat)
    return f"{intensity} {mood}"

CLUSTER_NAMES = {
    cid: auto_label_emotion(final_data[df["cluster"] == cid])
    for cid in np.unique(labels)
}


# -------------------------------------------------
# Title Map
# -------------------------------------------------
title_map = {name.lower(): idx for idx, name in enumerate(df["name"])}


# -------------------------------------------------
# Nearest Neighbors
# -------------------------------------------------
NN_PATH = CACHE_DIR / "nn.joblib"
if NN_PATH.exists():
    nn = load(NN_PATH)
else:
    nn = NearestNeighbors(metric="cosine", algorithm="brute")
    nn.fit(X_scaled)
    dump(nn, NN_PATH)


# -------------------------------------------------
# Search
# -------------------------------------------------
def search_titles(query: str, limit: int = 10):
    q = query.lower().strip()
    idx = title_map.get(q)
    if idx is not None:
        return final_data.iloc[[idx]][["name", "artists"]].to_dict("records")

    mask = final_data["name"].str.lower().str.startswith(q)
    return final_data.loc[mask].head(limit)[["name", "artists"]].to_dict("records")


# -------------------------------------------------
# Recommendations
# -------------------------------------------------
async def get_recommendations(query: str, top_n: int = 10, include_query: bool = False):
    q_lower = query.lower().strip()

    matches = final_data.index[
        (final_data["name"].str.lower() == q_lower) |
        (final_data["artists"].str.lower().str.contains(q_lower))
    ].tolist()

    if not matches:
        close = get_close_matches(
            q_lower,
            final_data["name"].str.lower().tolist(),
            n=1,
            cutoff=0.7
        )
        if close:
            matches = final_data.index[
                final_data["name"].str.lower() == close[0]
            ].tolist()

    if not matches:
        return []

    anchor_idx = matches[0]
    anchor_vec = X_scaled[anchor_idx].reshape(1, -1)

    distances, indices = nn.kneighbors(anchor_vec, n_neighbors=top_n + 20)
    distances, indices = distances[0], indices[0]

    weighted = []
    for dist, idx in zip(distances, indices):
        if idx == anchor_idx:
            continue

        sim = 1 - dist
        cluster_bonus = 0.1 if df.loc[idx, "cluster"] == df.loc[anchor_idx, "cluster"] else 0
        artist_bonus = 0.1 if df.loc[idx, "artists"] == df.loc[anchor_idx, "artists"] else 0

        weighted.append((idx, sim + cluster_bonus + artist_bonus))

    weighted.sort(key=lambda x: x[1], reverse=True)
    rec_indices = [idx for idx, _ in weighted[:top_n]]

    if include_query:
        rec_indices = [anchor_idx] + rec_indices

    out = []
    for idx in rec_indices:
        row = final_data.iloc[idx]

        minutes = int(row["duration_ms"] // 60000)
        seconds = int((row["duration_ms"] % 60000) // 1000)
        dur = f"{minutes}:{seconds:02d}"

        out.append({
            "name": row["name"],
            "artists": row["artists"],
            "album": row.get("album"),
            "release_year": int(row.get("year", 0)),
            "duration": dur,
            "cluster": int(row["cluster"]),
            "cluster_mood": CLUSTER_NAMES.get(row["cluster"], "Unknown"),
            "artwork": None,
            "preview": None,
            "youtubeUrl": None,
        })

    return out