from __future__ import annotations

# --------------------------------------------
# FIX FOR OLD PICKLE PATHS (IMPORTANT)
# --------------------------------------------
import sys
import app as app_package
sys.modules['app'] = app_package

# --------------------------------------------
# Standard imports
# --------------------------------------------
import os, ast, json, hashlib, asyncio, httpx, re
from pathlib import Path
from urllib.parse import quote
import numpy as np
import pandas as pd
from io import BytesIO
from difflib import get_close_matches
from joblib import Memory, dump, load
from bs4 import BeautifulSoup
import requests

# sklearn fallback (FAISS doesn't support py 3.13)
from sklearn.neighbors import NearestNeighbors

from .utils import MyMinMaxScaler, kmeans_mini_batch

# ============================================
# GOOGLE DRIVE DIRECT DOWNLOAD LINKS
# ============================================

CSV_URL = "https://drive.google.com/uc?export=download&id=1WWTv7djAE4-lPm7gtrfzJrDGY2hxuhD1"
LABELS_URL = "https://drive.google.com/uc?export=download&id=16F99o699_6xrBqqzw8r7k1kpKIeJ-IXA"

# ============================================
# CACHE
# ============================================
BASE_DIR = Path(__file__).parent
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)

memory = Memory(str(CACHE_DIR), verbose=0)

SCALER_FILE = CACHE_DIR / "scaler.joblib"
LABEL_FILE = CACHE_DIR / "labels.npy"
INDEX_FILE = CACHE_DIR / "nn_index.joblib"
ITUNES_CACHE_FILE = CACHE_DIR / "itunes_cache.json"

DEFAULT_ARTWORK = "https://example.com/default_artwork.png"

AUDIO_FEATS = [
    "danceability", "energy", "key", "loudness", "mode", "speechiness",
    "acousticness", "instrumentalness", "liveness", "valence", "tempo",
    "duration_ms"
]

# ============================================
# DOWNLOAD FROM GOOGLE DRIVE
# ============================================

def download_csv_from_drive(url):
    print("Downloading CSV from Google Drive...")
    resp = requests.get(url)
    resp.raise_for_status()
    return pd.read_csv(BytesIO(resp.content))

def download_labels_from_drive(url):
    print("Downloading labels.npy from Google Drive...")
    resp = requests.get(url)
    resp.raise_for_status()
    return np.load(BytesIO(resp.content), allow_pickle=True)

# ============================================
# LOAD CSV + LABELS
# ============================================

@memory.cache
def load_and_clean_data():
    df = download_csv_from_drive(CSV_URL)

    def clean_artists(val: str):
        if pd.isna(val):
            return ""
        try:
            artists = ast.literal_eval(val)
            return ", ".join(artists) if isinstance(artists, list) else str(val)
        except:
            return str(val)

    df["artists"] = df["artists"].apply(clean_artists)
    df = df.drop_duplicates(subset=["name", "artists"]).dropna(subset=["name"])
    df[AUDIO_FEATS] = df[AUDIO_FEATS].fillna(0).astype(np.float32)
    df.reset_index(drop=True, inplace=True)
    return df

df = load_and_clean_data()

# ============================================
# SCALE FEATURES
# ============================================

if SCALER_FILE.exists():
    scaler = load(SCALER_FILE)
    X_scaled = scaler.transform(df[AUDIO_FEATS].to_numpy(dtype=np.float32))
else:
    scaler = MyMinMaxScaler()
    X_scaled = scaler.fit_transform(df[AUDIO_FEATS].to_numpy(dtype=np.float32))
    dump(scaler, SCALER_FILE)

# ============================================
# CLUSTERING
# ============================================

NUM_CLUSTERS = 150

def load_or_create_labels():
    try:
        labels = download_labels_from_drive(LABELS_URL)
        if len(labels) == len(df):
            return labels
    except:
        pass

    print("Recomputing clusters...")
    labels, _ = kmeans_mini_batch(
        X_scaled, k=NUM_CLUSTERS, batch_size=100000, max_iter=200
    )
    np.save(LABEL_FILE, labels)
    return labels

labels = load_or_create_labels()
df["cluster"] = labels
final_data = df.copy()

# ============================================
# EMOTION LABELING
# ============================================

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

def auto_label_emotion(cluster_df):
    means = cluster_df[FEATURES_FOR_EMOTION].mean()
    min_val, max_val = means.min(), means.max()
    means_norm = (means - min_val) / (max_val - min_val) if max_val - min_val > 0 else means * 0
    top_feat = means_norm.idxmax()
    val = means_norm[top_feat]
    intensity = "Low" if val < 0.33 else ("Medium" if val < 0.66 else "High")
    mood = FEATURE_EMOTION_MAP.get(top_feat, top_feat.title())
    return f"{intensity} {mood}"

CLUSTER_NAMES = {
    cid: auto_label_emotion(final_data.loc[df["cluster"] == cid])
    for cid in np.unique(labels)
}

# ============================================
# TITLE SEARCH
# ============================================

title_map = {name.lower(): idx for idx, name in enumerate(df["name"])}

def search_titles(query: str, limit: int = 10):
    q = query.lower().strip()
    idx = title_map.get(q)
    if idx is not None:
        return final_data.iloc[[idx]][["name", "artists"]].to_dict("records")

    mask = final_data["name"].str.lower().str.startswith(q)
    return final_data.loc[mask].head(limit)[["name", "artists"]].to_dict("records")

# ============================================
# KNN INDEX
# ============================================

if INDEX_FILE.exists():
    nn = load(INDEX_FILE)
else:
    nn = NearestNeighbors(metric="cosine", algorithm="brute")
    nn.fit(X_scaled)
    dump(nn, INDEX_FILE)

# ============================================
# ITUNES FETCH
# ============================================

if ITUNES_CACHE_FILE.exists():
    with open(ITUNES_CACHE_FILE, "r", encoding="utf-8") as f:
        ITUNES_CACHE = json.load(f)
else:
    ITUNES_CACHE = {}

async def fetch_itunes(client: httpx.AsyncClient, song, artist):
    key = hashlib.md5(f"{song}|{artist}".encode()).hexdigest()
    if key in ITUNES_CACHE:
        return key, ITUNES_CACHE[key]

    url = f"https://itunes.apple.com/search?term={quote(song + ' ' + artist)}&limit=1"
    try:
        resp = await client.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        if data.get("resultCount", 0) > 0:
            r = data["results"][0]
            img = r.get("artworkUrl100") or r.get("artworkUrl60")
            if img:
                img = img.replace("100x100bb", "300x300bb")
            preview = r.get("previewUrl")
            ITUNES_CACHE[key] = (img, preview)
            return key, (img, preview)
    except:
        pass

    ITUNES_CACHE[key] = (None, None)
    return key, (None, None)

async def fetch_itunes_batch(songs):
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[fetch_itunes(client, s["name"], s["artists"]) for s in songs]
        )
    with open(ITUNES_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(ITUNES_CACHE, f)
    return {k: v for k, v in results}

# ============================================
# YOUTUBE FALLBACK
# ============================================

async def get_youtube_thumbnail_and_url(song, artist):
    query = f"{song} {artist} audio"
    url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
    html = resp.text
    m = re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
    if m:
        vid = m.group(1)
        return (
            f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
            f"https://www.youtube.com/watch?v={vid}"
        )
    return None, None

# ============================================
# RECOMMENDATIONS
# ============================================

async def get_recommendations(query: str, top_n: int = 10, include_query: bool = False):
    q = query.lower().strip()

    matches = final_data.index[
        (final_data["name"].str.lower() == q) |
        (final_data["artists"].str.lower().str.contains(q))
    ].tolist()

    if not matches:
        close = get_close_matches(q, final_data["name"].str.lower().tolist(), n=1, cutoff=0.7)
        if close:
            matches = final_data.index[final_data["name"].str.lower() == close[0]].tolist()

    if not matches:
        return []

    anchor = matches[0]
    anchor_vec = X_scaled[anchor].reshape(1, -1)

    distances, indices = nn.kneighbors(anchor_vec, n_neighbors=top_n + 20)
    distances, indices = distances[0], indices[0]

    weighted = []
    for dist, idx in zip(distances, indices):
        if idx == anchor:
            continue
        sim = 1 - dist
        sim += 0.1 if final_data.loc[idx, "cluster"] == final_data.loc[anchor, "cluster"] else 0
        sim += 0.1 if final_data.loc[idx, "artists"] == final_data.loc[anchor, "artists"] else 0
        weighted.append((idx, sim))

    weighted.sort(key=lambda x: x[1], reverse=True)
    rec_indices = [i for i, _ in weighted[:top_n]]

    if include_query:
        rec_indices.insert(0, anchor)

    rec_df = final_data.iloc[rec_indices][
        ["name", "artists", "cluster", "album", "year", "duration_ms"]
    ].copy()

    itunes_meta = await fetch_itunes_batch(rec_df.to_dict("records"))

    output = []
    for _, row in rec_df.iterrows():
        key = hashlib.md5(f"{row['name']}|{row['artists']}".encode()).hexdigest()
        img, preview = itunes_meta.get(key, (None, None))

        youtube_url = None
        if not preview:
            yt_img, yt_url = await get_youtube_thumbnail_and_url(row['name'], row['artists'])
            img = img or yt_img or DEFAULT_ARTWORK
            youtube_url = yt_url

        minutes = row["duration_ms"] // 60000
        seconds = (row["duration_ms"] % 60000) // 1000

        output.append({
            "name": row["name"],
            "artists": row["artists"],
            "album": row["album"],
            "release_year": int(row["year"]),
            "duration": f"{int(minutes)}:{int(seconds):02d}",
            "cluster": int(row["cluster"]),
            "cluster_mood": CLUSTER_NAMES.get(row["cluster"], "Unknown"),
            "artwork": img,
            "preview": preview,
            "youtubeUrl": youtube_url,
        })

    return output
