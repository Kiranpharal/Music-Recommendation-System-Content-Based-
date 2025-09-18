from __future__ import annotations

import sys, os, ast, json, hashlib, asyncio, httpx, re
from pathlib import Path
from urllib.parse import quote
import numpy as np
import pandas as pd
from difflib import get_close_matches
from joblib import Memory, dump, load
import faiss
from bs4 import BeautifulSoup
from .utils import MyMinMaxScaler, kmeans_mini_batch

# -------------------------
# Paths & cache
# -------------------------
BASE_DIR = Path(__file__).parent
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)
memory = Memory(str(CACHE_DIR), verbose=0)

CSV_PATH = BASE_DIR / "dataset" / "master_tracks.csv"
SCALER_FILE = CACHE_DIR / "scaler.joblib"
LABEL_FILE = CACHE_DIR / "labels.npy"
FAISS_INDEX_FILE = CACHE_DIR / "faiss_ivf.index"
ITUNES_CACHE_FILE = CACHE_DIR / "itunes_cache.json"

# -------------------------
# Audio features
# -------------------------
AUDIO_FEATS = [
    "danceability", "energy", "key", "loudness", "mode", "speechiness",
    "acousticness", "instrumentalness", "liveness", "valence", "tempo", "duration_ms"
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

# -------------------------
# Default artwork & preview
# -------------------------
DEFAULT_ARTWORK = "https://example.com/default_artwork.png"
DEFAULT_PREVIEW = None

# -------------------------
# Load & clean data
# -------------------------
@memory.cache
def load_and_clean_data(csv_path=CSV_PATH) -> pd.DataFrame:
    df = pd.read_csv(csv_path)

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
    df[AUDIO_FEATS] = df[AUDIO_FEATS].fillna(0).astype(np.float32)
    df.reset_index(drop=True, inplace=True)
    return df

df = load_and_clean_data()

# -------------------------
# Scale features
# -------------------------
if SCALER_FILE.exists():
    scaler = load(SCALER_FILE)
    X_scaled = scaler.transform(df[AUDIO_FEATS].to_numpy(dtype=np.float32))
else:
    scaler = MyMinMaxScaler()
    X_scaled = scaler.fit_transform(df[AUDIO_FEATS].to_numpy(dtype=np.float32))
    dump(scaler, SCALER_FILE)

# -------------------------
# Clustering
# -------------------------
NUM_CLUSTERS = 150

def cluster_data(X, n_clusters=NUM_CLUSTERS):
    labels, _ = kmeans_mini_batch(X, k=n_clusters, batch_size=100_000, max_iter=200)
    np.save(LABEL_FILE, labels)
    return labels

if LABEL_FILE.exists():
    labels = np.load(LABEL_FILE)
    if len(labels) != len(df):
        labels = cluster_data(X_scaled)
else:
    labels = cluster_data(X_scaled)

df["cluster"] = labels
final_data = df.copy()

# -------------------------
# Emotion labels
# -------------------------
def auto_label_emotion(cluster_df: pd.DataFrame):
    means = cluster_df[FEATURES_FOR_EMOTION].mean()
    min_val, max_val = means.min(), means.max()
    means_norm = (means - min_val) / (max_val - min_val) if max_val - min_val > 0 else means*0
    top_feat = means_norm.idxmax()
    val = means_norm[top_feat]
    intensity = "Low" if val < 0.33 else "Medium" if val < 0.66 else "High"
    mood = FEATURE_EMOTION_MAP.get(top_feat, top_feat.replace('_',' ').title())
    return f"{intensity} {mood}"

CLUSTER_NAMES = {
    cid: auto_label_emotion(final_data.loc[df['cluster'] == cid])
    for cid in np.unique(labels)
}

# -------------------------
# Title map for search
# -------------------------
title_map = {name.lower(): idx for idx, name in enumerate(df['name'])}

# -------------------------
# FAISS index
# -------------------------
DIM = X_scaled.shape[1]
X_norm = X_scaled / np.linalg.norm(X_scaled, axis=1, keepdims=True)

def build_faiss_ivf_index(X, nlist=500):
    quantizer = faiss.IndexFlatIP(DIM)
    index = faiss.IndexIVFFlat(quantizer, DIM, nlist, faiss.METRIC_INNER_PRODUCT)
    index.train(X.astype(np.float32))
    index.add(X.astype(np.float32))
    return index

if FAISS_INDEX_FILE.exists():
    faiss_index = faiss.read_index(str(FAISS_INDEX_FILE))
else:
    faiss_index = build_faiss_ivf_index(X_norm)
    faiss.write_index(faiss_index, str(FAISS_INDEX_FILE))

faiss_index.nprobe = 20

# -------------------------
# iTunes fetch
# -------------------------
if ITUNES_CACHE_FILE.exists():
    with open(ITUNES_CACHE_FILE, "r", encoding="utf-8") as f:
        ITUNES_CACHE = json.load(f)
else:
    ITUNES_CACHE = {}

async def fetch_itunes(client: httpx.AsyncClient, song: str, artist: str):
    key = hashlib.md5(f"{song}|{artist}".encode()).hexdigest()
    if key in ITUNES_CACHE:
        return key, ITUNES_CACHE[key]

    term = quote(f"{song} {artist}")
    url = f"https://itunes.apple.com/search?term={term}&limit=1"
    try:
        resp = await client.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        if data.get("resultCount", 0) > 0:
            r = data["results"][0]
            img = r.get("artworkUrl100") or r.get("artworkUrl60")
            if img:
                img = img.replace("100x100bb", "300x300bb")
            prev = r.get("previewUrl")  # Direct audio file
            ITUNES_CACHE[key] = (img, prev)
            return key, (img, prev)
    except Exception as e:
        print(f"iTunes fetch error for '{song}' by '{artist}': {e}")

    ITUNES_CACHE[key] = (None, None)
    return key, (None, None)

async def fetch_itunes_batch(songs):
    async with httpx.AsyncClient() as client:
        tasks = [fetch_itunes(client, s["name"], s["artists"]) for s in songs]
        results = await asyncio.gather(*tasks)
        with open(ITUNES_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(ITUNES_CACHE, f)
        return {k: v for k, v in results}

# -------------------------
# YouTube fallback (no API)
# -------------------------
async def get_youtube_thumbnail_and_url(song, artist):
    query = f"{song} {artist} audio"
    search_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(search_url)
        html = resp.text
    match = re.search(r"\"videoId\":\"([a-zA-Z0-9_-]{11})\"", html)
    if match:
        video_id = match.group(1)
        thumbnail = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        return thumbnail, video_url
    return None, None

# -------------------------
# Search
# -------------------------
def search_titles(query: str, limit: int = 10):
    q = query.lower().strip()
    idx = title_map.get(q)
    if idx is not None:
        return final_data.iloc[[idx]][["name", "artists"]].to_dict("records")
    mask = final_data['name'].str.lower().str.startswith(q)
    return final_data.loc[mask].head(limit)[["name", "artists"]].to_dict("records")

# -------------------------
# Recommendations (audio + YouTube fallback)
# -------------------------
async def get_recommendations(query: str, top_n: int = 10, include_query: bool = False):
    q_lower = query.lower().strip()

    matches = final_data.index[
        (final_data["name"].str.lower() == q_lower) |
        (final_data["artists"].str.lower().str.contains(q_lower, regex=False))
    ].tolist()

    if not matches:
        close = get_close_matches(q_lower, final_data["name"].str.lower().tolist(), n=1, cutoff=0.7)
        if close:
            matches = final_data.index[final_data["name"].str.lower() == close[0]].tolist()

    if not matches:
        return []

    anchor_idx = matches[0]
    anchor_vec = X_norm[anchor_idx].reshape(1, -1)
    D, I = faiss_index.search(anchor_vec.astype(np.float32), top_n + 20)
    indices = I[0]

    weighted_scores = []
    for idx in indices:
        if idx == anchor_idx:
            continue
        sim = float(D[0][np.where(indices==idx)[0][0]])
        cluster_bonus = 0.1 if final_data.loc[idx, "cluster"] == final_data.loc[anchor_idx, "cluster"] else 0
        artist_bonus = 0.1 if final_data.loc[idx, "artists"] == final_data.loc[anchor_idx, "artists"] else 0
        weighted_scores.append((idx, sim + cluster_bonus + artist_bonus))

    weighted_scores.sort(key=lambda x: x[1], reverse=True)
    rec_indices = [idx for idx, _ in weighted_scores[:top_n]]
    if include_query:
        rec_indices = [anchor_idx] + rec_indices

    rec_df = final_data.iloc[rec_indices][["name", "artists", "cluster", "album", "year", "duration_ms"]].copy()
    itunes_meta = await fetch_itunes_batch(rec_df.to_dict("records"))

    recs = []
    for _, row in rec_df.iterrows():
        key = hashlib.md5(f"{row['name']}|{row['artists']}".encode()).hexdigest()
        img, preview = itunes_meta.get(key, (None, None))
        youtube_url = None

        # Only use YouTube fallback if preview is not a direct audio file
        if preview is None or not re.search(r"\.(mp3|m4a|wav|ogg)$", preview, re.IGNORECASE):
            yt_img, yt_url = await get_youtube_thumbnail_and_url(row['name'], row['artists'])
            img = img or yt_img or DEFAULT_ARTWORK
            youtube_url = yt_url or None
            preview = preview if preview and re.search(r"\.(mp3|m4a|wav|ogg)$", preview, re.IGNORECASE) else None
        else:
            preview = preview  # valid audio
            youtube_url = None

        minutes = int(row["duration_ms"] // 60000)
        seconds = int((row["duration_ms"] % 60000) // 1000)
        duration_formatted = f"{minutes}:{seconds:02d}"

        recs.append({
            "name": row["name"],
            "artists": row["artists"],
            "album": row["album"],
            "release_year": int(row["year"]),
            "duration": duration_formatted,
            "cluster": int(row["cluster"]),
            "cluster_mood": CLUSTER_NAMES.get(row["cluster"], "Unknown"),
            "artwork": img,
            "preview": preview,       # only playable audio
            "youtubeUrl": youtube_url  # fallback if preview is missing
        })

    return recs
