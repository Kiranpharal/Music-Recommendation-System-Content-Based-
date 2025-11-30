# server/app/models.py

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
)
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)

    is_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)

    created_at = Column(DateTime, default=_utcnow)

    # Email verification
    verification_token = Column(String, nullable=True)
    verification_expires_at = Column(DateTime, nullable=True)

    # Password reset token & expiry
    reset_token = Column(String, nullable=True)
    reset_expires_at = Column(DateTime, nullable=True)

    # Relationships
    playlists = relationship(
        "Playlist",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    liked_songs = relationship(
        "LikedSong",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r}>"


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="playlists")

    songs = relationship(
        "PlaylistSong",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Playlist id={self.id} name={self.name!r} user_id={self.user_id}>"


class PlaylistSong(Base):
    __tablename__ = "playlist_songs"

    id = Column(Integer, primary_key=True, index=True)

    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=False)
    song_id = Column(String, nullable=False, index=True)

    # Core song metadata
    song_title = Column(String, nullable=False)
    song_artist = Column(String, nullable=False)
    song_preview_url = Column(String, nullable=True)

    # Extended metadata (mirrors what frontend sends / uses)
    song_artwork = Column(String, nullable=True)
    song_youtube_url = Column(String, nullable=True)
    song_cluster_mood = Column(String, nullable=True)
    song_duration = Column(String, nullable=True)
    song_album = Column(String, nullable=True)
    song_release_year = Column(Integer, nullable=True)
    song_source = Column(String, nullable=True)

    created_at = Column(DateTime, default=_utcnow)

    playlist = relationship("Playlist", back_populates="songs")

    def __repr__(self) -> str:
        return (
            f"<PlaylistSong id={self.id} playlist_id={self.playlist_id} "
            f"song_id={self.song_id}>"
        )


class LikedSong(Base):
    __tablename__ = "liked_songs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    song_id = Column(String, nullable=False, index=True)

    # Core song metadata
    song_title = Column(String, nullable=False)
    song_artist = Column(String, nullable=False)
    song_preview_url = Column(String, nullable=True)

    # Extended metadata (same shape as PlaylistSong)
    song_artwork = Column(String, nullable=True)
    song_youtube_url = Column(String, nullable=True)
    song_cluster_mood = Column(String, nullable=True)
    song_duration = Column(String, nullable=True)
    song_album = Column(String, nullable=True)
    song_release_year = Column(Integer, nullable=True)
    song_source = Column(String, nullable=True)

    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="liked_songs")

    def __repr__(self) -> str:
        return f"<LikedSong id={self.id} user_id={self.user_id} song_id={self.song_id}>"
