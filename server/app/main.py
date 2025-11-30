# server/app/main.py
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .database import SessionLocal, init_db
from . import models
from .auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)
from .email_utils import send_verification_email, send_password_reset_email
from .recommender import search_titles, get_recommendations

# -------------------------------------------------------
# FASTAPI APP + CORS
# -------------------------------------------------------

app = FastAPI(title="Music Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------
# DB Dependency
# -------------------------------------------------------

def get_db():
  db = SessionLocal()
  try:
      yield db
  finally:
      db.close()

# -------------------------------------------------------
# Helpers
# -------------------------------------------------------

def _now_utc():
  return datetime.now(timezone.utc)


def _make_song_id(name: str, artists: str) -> str:
  return hashlib.md5(f"{name}|{artists}".encode()).hexdigest()

# -------------------------------------------------------
# User Auth Dependencies
# -------------------------------------------------------

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> models.User:
  if not authorization or not authorization.startswith("Bearer "):
      raise HTTPException(401, "Missing or invalid Authorization header")

  token = authorization.split(" ")[1]
  payload = decode_access_token(token)

  if not payload or "sub" not in payload:
      raise HTTPException(401, "Invalid or expired token")

  user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
  if not user:
      raise HTTPException(401, "User not found")

  return user


def get_admin_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> models.User:
  if not authorization or not authorization.startswith("Bearer "):
      raise HTTPException(401, "Missing admin Authorization header")

  token = authorization.split(" ")[1]
  payload = decode_access_token(token)

  if not payload or not payload.get("admin"):
      raise HTTPException(401, "Invalid admin token")

  user = (
      db.query(models.User)
      .filter(models.User.id == int(payload["sub"]), models.User.is_admin == True)
      .first()
  )

  if not user:
      raise HTTPException(403, "Admin not found or unauthorized")

  return user

# -------------------------------------------------------
# Schemas
# -------------------------------------------------------

class RegisterRequest(BaseModel):
  username: str
  email: EmailStr
  password: str

class RegisterResponse(BaseModel):
  message: str
  user_id: int

class LoginRequest(BaseModel):
  identifier: str
  password: str

class AdminCreateRequest(BaseModel):
  username: str
  email: EmailStr
  password: str

class AdminLoginRequest(BaseModel):
  identifier: str
  password: str

class TokenPair(BaseModel):
  access_token: str
  refresh_token: str
  token_type: str = "bearer"

class RefreshRequest(BaseModel):
  refresh_token: str

class PlaylistCreateRequest(BaseModel):
  name: str

class ForgotPasswordRequest(BaseModel):
  email: EmailStr

class PasswordResetRequest(BaseModel):
  token: str
  new_password: str

class SongIn(BaseModel):
  id: Optional[str]
  name: str
  artists: str
  artwork: Optional[str] = None
  preview: Optional[str] = None
  youtubeUrl: Optional[str] = None
  cluster_mood: Optional[str] = None
  duration: Optional[str] = None
  album: Optional[str] = None
  release_year: Optional[int] = None
  source: Optional[str] = None

class SongOut(BaseModel):
  id: str
  name: str
  artists: str
  artwork: Optional[str]
  preview: Optional[str]
  youtubeUrl: Optional[str]
  cluster_mood: Optional[str]
  duration: Optional[str]
  album: Optional[str]
  release_year: Optional[int]
  source: Optional[str]

class PlaylistOut(BaseModel):
  id: int
  name: str
  songs: List[SongOut]

class ChangePasswordRequest(BaseModel):
  old_password: str
  new_password: str

class UpdateUsernameRequest(BaseModel):
  username: str

class UpdateEmailRequest(BaseModel):
  email: EmailStr

# -------------------------------------------------------
# Startup
# -------------------------------------------------------

@app.on_event("startup")
def startup():
  init_db()
  create_initial_admin_if_missing()

def create_initial_admin_if_missing():
  db = SessionLocal()
  try:
      existing = db.query(models.User).filter(models.User.is_admin == True).first()
      if not existing:
          admin = models.User(
              username="admin",
              email="admin@musicrec.com",
              password_hash=hash_password("Admin@123"),
              is_verified=True,
              is_admin=True,
          )
          db.add(admin)
          db.commit()
          print("✔ Default admin created: admin@musicrec.com / Admin@123")
  finally:
      db.close()

# -------------------------------------------------------
# Registration + Verification
# -------------------------------------------------------

@app.post("/register", response_model=RegisterResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
  exists = db.query(models.User).filter(
      (models.User.username == req.username) | (models.User.email == req.email)
  ).first()

  if exists:
      raise HTTPException(400, "Username or email already exists")

  user = models.User(
      username=req.username,
      email=req.email,
      password_hash=hash_password(req.password),
      is_verified=False,
      is_admin=False,
  )

  token = secrets.token_urlsafe(32)
  user.verification_token = token
  user.verification_expires_at = _now_utc() + timedelta(hours=24)

  db.add(user)
  db.commit()
  db.refresh(user)

  try:
      send_verification_email(user.email, token)
  except:
      pass

  return RegisterResponse(message="Registration successful", user_id=user.id)


@app.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
  user = db.query(models.User).filter(models.User.verification_token == token).first()

  if not user:
      raise HTTPException(400, "Invalid verification token")

  exp = user.verification_expires_at
  if exp and exp.tzinfo is None:
      exp = exp.replace(tzinfo=timezone.utc)

  if exp and exp < _now_utc():
      raise HTTPException(400, "Verification token expired")

  user.is_verified = True
  user.verification_token = None
  user.verification_expires_at = None
  db.commit()

  return {"message": "Email verified successfully"}

# -------------------------------------------------------
# Forgot + Reset Password
# -------------------------------------------------------

@app.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
  user = db.query(models.User).filter(models.User.email == req.email).first()

  # Always return the same message to prevent email enumeration
  if not user:
      return {"message": "If an account exists, a reset link was sent."}

  token = secrets.token_urlsafe(32)

  user.reset_token = token
  user.reset_expires_at = _now_utc() + timedelta(hours=1)
  db.commit()

  try:
      send_password_reset_email(req.email, token)
  except:
      pass

  return {"message": "If an account exists, a reset link was sent."}


@app.post("/reset-password")
def reset_password(req: PasswordResetRequest, db: Session = Depends(get_db)):
  user = db.query(models.User).filter(models.User.reset_token == req.token).first()
  if not user:
      raise HTTPException(400, "Invalid or expired reset token.")

  exp = user.reset_expires_at
  if exp and exp.tzinfo is None:
      exp = exp.replace(tzinfo=timezone.utc)

  if not exp or exp < _now_utc():
      raise HTTPException(400, "Password reset token expired.")

  user.password_hash = hash_password(req.new_password)
  user.reset_token = None
  user.reset_expires_at = None
  db.commit()

  return {"message": "Password reset successful. You can now log in."}

# -------------------------------------------------------
# Login + Refresh Token
# -------------------------------------------------------

@app.post("/login", response_model=TokenPair)
def login(req: LoginRequest, db: Session = Depends(get_db)):
  user = db.query(models.User).filter(
      (models.User.email == req.identifier) | (models.User.username == req.identifier)
  ).first()

  if not user or not verify_password(req.password, user.password_hash):
      raise HTTPException(401, "Invalid credentials")

  access = create_access_token({"sub": str(user.id), "admin": user.is_admin})
  refresh = create_refresh_token({"sub": str(user.id), "admin": user.is_admin})

  return TokenPair(access_token=access, refresh_token=refresh)


@app.post("/refresh-token", response_model=TokenPair)
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
  payload = decode_refresh_token(req.refresh_token)
  if not payload or "sub" not in payload:
      raise HTTPException(401, "Invalid refresh token")

  user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()

  if not user:
      raise HTTPException(401, "User not found")

  return TokenPair(
      access_token=create_access_token({"sub": str(user.id), "admin": user.is_admin}),
      refresh_token=create_refresh_token({"sub": str(user.id), "admin": user.is_admin}),
  )

# -------------------------------------------------------
# Admin Login + Admin Features
# -------------------------------------------------------

@app.post("/admin/create")
def admin_create(req: AdminCreateRequest, admin=Depends(get_admin_user), db: Session = Depends(get_db)):
  exists = db.query(models.User).filter(
      (models.User.username == req.username) | (models.User.email == req.email)
  ).first()

  if exists:
      raise HTTPException(400, "Username or email already exists")

  new_admin = models.User(
      username=req.username,
      email=req.email,
      password_hash=hash_password(req.password),
      is_verified=True,
      is_admin=True,
  )

  db.add(new_admin)
  db.commit()
  db.refresh(new_admin)

  return {
      "message": "Admin created successfully",
      "id": new_admin.id,
      "username": new_admin.username,
      "email": new_admin.email,
  }

@app.post("/admin/login")
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
  user = db.query(models.User).filter(
      (models.User.email == req.identifier) | (models.User.username == req.identifier)
  ).first()

  if not user or not verify_password(req.password, user.password_hash):
      raise HTTPException(401, "Invalid credentials")

  if not user.is_admin:
      raise HTTPException(403, "Access denied — not an admin")

  access = create_access_token({"sub": str(user.id), "admin": True})
  refresh = create_refresh_token({"sub": str(user.id), "admin": True})

  return {
      "access_token": access,
      "refresh_token": refresh,
      "token_type": "bearer",
  }


@app.get("/admin/users")
def list_users(admin=Depends(get_admin_user), db: Session = Depends(get_db)):
  users = db.query(models.User).all()
  return [
      {
          "id": u.id,
          "username": u.username,
          "email": u.email,
          "is_verified": u.is_verified,
          "is_admin": u.is_admin,
          "joined": u.created_at,
      }
      for u in users
  ]


@app.get("/admin/user_stats/{user_id}")
def admin_user_stats(user_id: int, admin=Depends(get_admin_user), db: Session = Depends(get_db)):
  playlists = db.query(models.Playlist).filter(models.Playlist.user_id == user_id).count()
  liked = db.query(models.LikedSong).filter(models.LikedSong.user_id == user_id).count()

  return {
      "user_id": user_id,
      "playlists": playlists,
      "liked_songs": liked,
  }


@app.get("/admin/stats")
def admin_stats(admin=Depends(get_admin_user), db: Session = Depends(get_db)):
  total_users = db.query(models.User).count()
  total_admins = db.query(models.User).filter(models.User.is_admin == True).count()
  total_playlists = db.query(models.Playlist).count()
  total_liked_songs = db.query(models.LikedSong).count()

  return {
      "total_users": total_users,
      "total_admins": total_admins,
      "normal_users": total_users - total_admins,
      "total_playlists": total_playlists,
      "total_liked_songs": total_liked_songs,
  }


@app.post("/admin/promote/{user_id}")
def promote_user(user_id: int, admin=Depends(get_admin_user), db: Session = Depends(get_db)):
  user = db.query(models.User).filter(models.User.id == user_id).first()
  if not user:
      raise HTTPException(404, "User not found")

  user.is_admin = True
  db.commit()
  return {"message": "User promoted to admin"}


@app.post("/admin/demote/{user_id}")
def demote_user(user_id: int, admin=Depends(get_admin_user), db: Session = Depends(get_db)):
  user = db.query(models.User).filter(models.User.id == user_id).first()
  if not user:
      raise HTTPException(404, "User not found")

  if user.id == admin.id:
      raise HTTPException(403, "Admins cannot demote themselves")

  user.is_admin = False
  db.commit()
  return {"message": "User demoted"}


@app.delete("/admin/delete/{user_id}")
def admin_delete_user(user_id: int, admin=Depends(get_admin_user), db: Session = Depends(get_db)):
  user = db.query(models.User).filter(models.User.id == user_id).first()
  if not user:
      raise HTTPException(404, "User not found")

  db.delete(user)
  db.commit()

  return {"message": "User deleted"}

# -------------------------------------------------------
# Profile
# -------------------------------------------------------

@app.get("/me")
def get_me(user=Depends(get_current_user)):
  return {
      "id": user.id,
      "username": user.username,
      "email": user.email,
      "created_at": user.created_at,
      "is_verified": user.is_verified,
      "is_admin": user.is_admin,
  }


@app.post("/change-password")
def change_password(req: ChangePasswordRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
  if not verify_password(req.old_password, user.password_hash):
      raise HTTPException(400, "Current password incorrect")

  user.password_hash = hash_password(req.new_password)
  db.commit()

  return {"message": "Password changed successfully"}


@app.post("/update-username")
def update_username(req: UpdateUsernameRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
  exists = db.query(models.User).filter(models.User.username == req.username).first()
  if exists:
      raise HTTPException(400, "Username already taken")

  user.username = req.username
  db.commit()

  return {"message": "Username updated", "username": req.username}


@app.post("/update-email")
def update_email(req: UpdateEmailRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
  exists = db.query(models.User).filter(models.User.email == req.email).first()
  if exists:
      raise HTTPException(400, "Email already exists")

  user.email = req.email
  user.is_verified = False

  # generate new verification token & send email
  token = secrets.token_urlsafe(32)
  user.verification_token = token
  user.verification_expires_at = _now_utc() + timedelta(hours=24)
  db.commit()

  try:
      send_verification_email(user.email, token)
  except:
      pass

  return {"message": "Email updated. Verification sent again.", "email": req.email}

# -------------------------------------------------------
# Search + Recommendations
# -------------------------------------------------------

@app.get("/search")
def search(q: str, limit: int = 10):
  res = search_titles(q, limit)
  output = []
  for r in res:
      sid = _make_song_id(r["name"], r["artists"])
      output.append({"id": sid, **r})
  return output


@app.get("/recommend")
async def recommend(song: str, top_n: int = 10):
  recs = await get_recommendations(song, top_n, include_query=False)

  if not recs:
      raise HTTPException(404, "Song not found")

  enriched = []
  for r in recs:
      sid = _make_song_id(r["name"], r["artists"])
      enriched.append({"id": sid, **r})

  return {"input_song": song, "recommendations": enriched}

# -------------------------------------------------------
# Playlists
# -------------------------------------------------------

@app.get("/playlists", response_model=List[PlaylistOut])
def get_playlists(user=Depends(get_current_user), db: Session = Depends(get_db)):
  pls = db.query(models.Playlist).filter(models.Playlist.user_id == user.id).all()
  out = []

  for p in pls:
      songs = [
          SongOut(
              id=s.song_id,
              name=s.song_title,
              artists=s.song_artist,
              artwork=s.song_artwork,
              preview=s.song_preview_url,
              youtubeUrl=s.song_youtube_url,
              cluster_mood=s.song_cluster_mood,
              duration=s.song_duration,
              album=s.song_album,
              release_year=s.song_release_year,
              source=s.song_source,
          )
          for s in p.songs
      ]

      out.append(PlaylistOut(id=p.id, name=p.name, songs=songs))

  return out


@app.post("/playlists", response_model=PlaylistOut)
def create_playlist(req: PlaylistCreateRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
  pl = models.Playlist(user_id=user.id, name=req.name)
  db.add(pl)
  db.commit()
  db.refresh(pl)

  return PlaylistOut(id=pl.id, name=pl.name, songs=[])


@app.delete("/playlists/{playlist_id}")
def delete_playlist(playlist_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
  pl = db.query(models.Playlist).filter(
      models.Playlist.id == playlist_id, models.Playlist.user_id == user.id
  ).first()

  if not pl:
      raise HTTPException(404, "Playlist not found")

  db.delete(pl)
  db.commit()

  return {"message": "Playlist deleted"}


@app.post("/playlists/{playlist_id}/add_song")
def add_song(playlist_id: int, song: SongIn, user=Depends(get_current_user), db: Session = Depends(get_db)):
  pl = db.query(models.Playlist).filter(
      models.Playlist.id == playlist_id, models.Playlist.user_id == user.id
  ).first()

  if not pl:
      raise HTTPException(404, "Playlist not found")

  song_id = song.id or _make_song_id(song.name, song.artists)

  exists = db.query(models.PlaylistSong).filter(
      models.PlaylistSong.playlist_id == playlist_id, models.PlaylistSong.song_id == song_id
  ).first()

  if exists:
      return {"message": "Song already in playlist"}

  entry = models.PlaylistSong(
      playlist_id=playlist_id,
      song_id=song_id,
      song_title=song.name,
      song_artist=song.artists,
      song_preview_url=song.preview,
      song_artwork=song.artwork,
      song_youtube_url=song.youtubeUrl,
      song_cluster_mood=song.cluster_mood,
      song_duration=song.duration,
      song_album=song.album,
      song_release_year=song.release_year,
      song_source=song.source,
  )

  db.add(entry)
  db.commit()

  return {"message": "Song added to playlist"}


@app.delete("/playlists/{playlist_id}/songs/{song_id}")
def remove_song(playlist_id: int, song_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
  ps = db.query(models.PlaylistSong).filter(
      models.PlaylistSong.playlist_id == playlist_id,
      models.PlaylistSong.song_id == song_id,
  ).first()

  if not ps:
      raise HTTPException(404, "Song not in playlist")

  db.delete(ps)
  db.commit()

  return {"message": "Song removed"}

# -------------------------------------------------------
# Liked Songs
# -------------------------------------------------------

@app.get("/liked_songs", response_model=List[SongOut])
def liked_songs_list(user=Depends(get_current_user), db: Session = Depends(get_db)):
  rows = db.query(models.LikedSong).filter(models.LikedSong.user_id == user.id).all()

  return [
      SongOut(
          id=s.song_id,
          name=s.song_title,
          artists=s.song_artist,
          artwork=s.song_artwork,
          preview=s.song_preview_url,
          youtubeUrl=s.song_youtube_url,
          cluster_mood=s.song_cluster_mood,
          duration=s.song_duration,
          album=s.song_album,
          release_year=s.song_release_year,
          source=s.song_source,
      )
      for s in rows
  ]


@app.post("/liked_songs")
def toggle_like(song: SongIn, user=Depends(get_current_user), db: Session = Depends(get_db)):
  song_id = song.id or _make_song_id(song.name, song.artists)

  existing = db.query(models.LikedSong).filter(
      models.LikedSong.user_id == user.id, models.LikedSong.song_id == song_id
  ).first()

  if existing:
      db.delete(existing)
      db.commit()
      return {"liked": False}

  entry = models.LikedSong(
      user_id=user.id,
      song_id=song_id,
      song_title=song.name,
      song_artist=song.artists,
      song_preview_url=song.preview,
      song_artwork=song.artwork,
      song_youtube_url=song.youtubeUrl,
      song_cluster_mood=song.cluster_mood,
      song_duration=song.duration,
      song_album=song.album,
      song_release_year=song.release_year,
      song_source=song.source,
  )

  db.add(entry)
  db.commit()

  return {"liked": True}
