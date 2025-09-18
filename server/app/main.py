# server/app/main.py
from typing import List
from fastapi import FastAPI, Query, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import hashlib
from .recommender import get_recommendations, search_titles, final_data
from . import models, auth, database
from difflib import get_close_matches

# ───────── App Setup ─────────
app = FastAPI(
    title="Music Recommender API",
    description="FAISS + KMeans powered large-scale music recommender system",
    version="1.3.0",
)

# ───────── CORS ─────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ───────── Database Dependency ─────────
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ───────── Models ─────────
class SongRequest(BaseModel):
    song_name: str
    top_n: int = 5

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

class PlaylistCreate(BaseModel):
    name: str

class SongData(BaseModel):
    id: str | None = None
    name: str
    artists: str
    preview: str | None = None
    artwork: str | None = None
    album: str | None = None
    release_year: int | None = None
    duration: int | None = None

class LoginRequest(BaseModel):
    email: str
    password: str

# ───────── Helper Functions ─────────
def generate_song_id(name: str, artists: str) -> str:
    return hashlib.md5(f"{name}|{artists}".encode()).hexdigest()

def determine_source(preview, artwork):
    if preview and "itunes" in (preview or "").lower():
        return "iTunes"
    elif preview or artwork:
        return "YouTube"
    else:
        return "Unknown"

# ───────── Recommendation Endpoints ─────────
@app.get("/recommend")
async def recommend_get(
    song: str = Query(...),
    top_n: int = Query(5, ge=1, le=50),
):
    result = await get_recommendations(song, top_n=top_n)
    if not result:
        raise HTTPException(status_code=404, detail=f"No recommendations found for '{song}'")
    for r in result:
        r["id"] = generate_song_id(r["name"], r["artists"])
        r["source"] = determine_source(r.get("preview"), r.get("artwork"))
        r["album"] = r.get("album")
        r["release_year"] = r.get("release_year")
        r["duration"] = r.get("duration_ms")  # from dataset
    return {"input_song": song, "recommendations": result}

@app.post("/recommend")
async def recommend_post(request: SongRequest):
    result = await get_recommendations(request.song_name, top_n=request.top_n)
    if not result:
        raise HTTPException(status_code=404, detail=f"No recommendations found for '{request.song_name}'")
    for r in result:
        r["id"] = generate_song_id(r["name"], r["artists"])
        r["source"] = determine_source(r.get("preview"), r.get("artwork"))
        r["album"] = r.get("album")
        r["release_year"] = r.get("release_year")
        r["duration"] = r.get("duration_ms")
    return {"input_song": request.song_name, "recommendations": result}

# ───────── Search Endpoint (song name + artist only) ─────────
@app.get("/search")
async def search_songs(q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=50), fuzzy: bool = Query(False)):
    q_lower = q.lower().strip()
    results = search_titles(q_lower, limit=limit)
    if not results and fuzzy:
        names = final_data['name'].str.lower().tolist()
        close = get_close_matches(q_lower, names, n=limit, cutoff=0.7)
        results = final_data[final_data['name'].str.lower().isin(close)][["name", "artists"]].to_dict("records")
    return [{"name": r["name"], "artists": r["artists"]} for r in results]

# ───────── Health Check ─────────
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "music-recommender"}

# ───────── User Authentication ─────────
@app.post("/register")
def register(user: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = auth.hash_password(user.password)
    new_user = models.User(username=user.username, email=user.email, password_hash=hashed)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.id}

@app.post("/login")
def login(user: LoginRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    token = auth.create_access_token({"user_id": db_user.id})
    return {"access_token": token, "token_type": "bearer"}

# ───────── Playlist Endpoints ─────────
@app.post("/playlists")
def create_playlist(playlist: PlaylistCreate, authorization: str = Header(...), db: Session = Depends(get_db)):
    token = authorization.replace("Bearer ", "")
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Unauthorized")
    pl = models.Playlist(name=playlist.name, user_id=payload["user_id"])
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return {"message": "Playlist created", "playlist_id": pl.id}

@app.post("/playlists/{playlist_id}/add_song")
def add_song_to_playlist(
    playlist_id: int, song: SongData, authorization: str = Header(...), db: Session = Depends(get_db)
):
    token = authorization.replace("Bearer ", "")
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Unauthorized")
    pl_song = models.PlaylistSong(
        playlist_id=playlist_id,
        song_id=song.id or generate_song_id(song.name, song.artists),
        song_title=song.name,
        song_artist=song.artists,
        song_preview_url=song.preview,
    )
    db.add(pl_song)
    db.commit()
    return {"message": "Song added to playlist"}

@app.get("/playlists")
def get_playlists(authorization: str = Header(...), db: Session = Depends(get_db)):
    token = authorization.replace("Bearer ", "")
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Unauthorized")
    
    playlists = db.query(models.Playlist).filter(models.Playlist.user_id == payload["user_id"]).all()
    
    result = []
    for pl in playlists:
        result.append({
            "id": pl.id,
            "name": pl.name,
            "songs": [
                {
                    "id": s.song_id,
                    "name": s.song_title,
                    "artists": s.song_artist,
                    "preview": s.song_preview_url,
                } for s in pl.songs
            ]
        })
    return result

@app.delete("/playlists/{playlist_id}/songs/{song_id}")
def remove_song_from_playlist(
    playlist_id: int,
    song_id: str,
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    token = authorization.replace("Bearer ", "")
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Unauthorized")

    pl_song = db.query(models.PlaylistSong).filter(
        models.PlaylistSong.playlist_id == playlist_id,
        models.PlaylistSong.song_id == song_id
    ).first()

    if not pl_song:
        raise HTTPException(404, "Song not found in playlist")

    db.delete(pl_song)
    db.commit()
    return {"message": "Song removed from playlist"}

@app.delete("/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    token = authorization.replace("Bearer ", "")
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Unauthorized")

    pl = db.query(models.Playlist).filter(
        models.Playlist.id == playlist_id,
        models.Playlist.user_id == payload["user_id"]
    ).first()

    if not pl:
        raise HTTPException(404, "Playlist not found")

    db.query(models.PlaylistSong).filter(models.PlaylistSong.playlist_id == playlist_id).delete()
    db.delete(pl)
    db.commit()
    return {"message": "Playlist deleted successfully"}

# ───────── Liked Songs Endpoints ─────────
@app.post("/liked_songs")
def toggle_like_song(song: SongData, authorization: str = Header(...), db: Session = Depends(get_db)):
    token = authorization.replace("Bearer ", "")
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Unauthorized")

    song_id = song.id or generate_song_id(song.name, song.artists)

    existing = db.query(models.LikedSong).filter(
        models.LikedSong.user_id == payload["user_id"],
        models.LikedSong.song_id == song_id
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"message": "Song unliked", "liked": False}
    else:
        liked = models.LikedSong(
            user_id=payload["user_id"],
            song_id=song_id,
            song_title=song.name,
            song_artist=song.artists,
            song_preview_url=song.preview,
        )
        db.add(liked)
        db.commit()
        return {"message": "Song liked", "liked": True}

@app.get("/liked_songs")
def get_liked_songs(authorization: str = Header(...), db: Session = Depends(get_db)):
    token = authorization.replace("Bearer ", "")
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Unauthorized")

    liked_songs = db.query(models.LikedSong).filter(
        models.LikedSong.user_id == payload["user_id"]
    ).all()

    return [
        {
            "id": song.song_id,
            "name": song.song_title,
            "artists": song.song_artist,
            "preview": song.song_preview_url,
        }
        for song in liked_songs
    ]
