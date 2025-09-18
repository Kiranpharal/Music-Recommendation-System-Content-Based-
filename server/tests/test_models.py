# server/tests/test_models.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import User, Playlist, PlaylistSong, LikedSong

# Use in-memory SQLite for testing
@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_user_playlist_relationship(db_session):
    user = User(username="u1", email="u1@example.com", password_hash="h")
    db_session.add(user)
    db_session.commit()

    playlist = Playlist(name="MyList", user_id=user.id)
    db_session.add(playlist)
    db_session.commit()

    fetched_user = db_session.query(User).filter_by(id=user.id).first()
    assert len(fetched_user.playlists) == 1
    assert fetched_user.playlists[0].name == "MyList"

def test_liked_song_crud(db_session):
    user = User(username="u2", email="u2@example.com", password_hash="h")
    db_session.add(user)
    db_session.commit()

    liked = LikedSong(user_id=user.id, song_id="s1", song_title="Song 1", song_artist="Artist")
    db_session.add(liked)
    db_session.commit()

    fetched = db_session.query(LikedSong).filter_by(user_id=user.id).first()
    assert fetched.song_title == "Song 1"

    db_session.delete(fetched)
    db_session.commit()
    assert db_session.query(LikedSong).filter_by(user_id=user.id).count() == 0
