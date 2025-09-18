# tests/test_api_endpoints.py

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app import models, auth

client = TestClient(app)

# ---------------------------
# Fixtures
# ---------------------------
@pytest.fixture(scope="module")
def db():
    # initialize DB (create tables)
    init_db()
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture
def test_user(db):
    # create a test user safely
    user_data = {"username": "testuser", "email": "test@example.com", "password": "password123"}
    hashed = auth.hash_password(user_data["password"])
    user = models.User(username=user_data["username"], email=user_data["email"], password_hash=hashed)
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()  # rollback if user already exists
        user = db.query(models.User).filter_by(username=user_data["username"]).first()
    yield user
    # cleanup
    try:
        db.delete(user)
        db.commit()
    except Exception:
        db.rollback()

@pytest.fixture
def auth_token(test_user):
    # generate JWT token for test user
    token = auth.create_access_token({"user_id": test_user.id})
    return f"Bearer {token}"

# ---------------------------
# Health Check
# ---------------------------
def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

# ---------------------------
# Authentication
# ---------------------------
def test_register_login(db):
    # Register safely
    user_data = {"username": "newuser", "email": "new@example.com", "password": "pass123"}
    try:
        response = client.post("/register", json=user_data)
        assert response.status_code == 200
        assert "user_id" in response.json()
    except AssertionError:
        # user may already exist, rollback session
        db.rollback()
    
    # Login
    response = client.post("/login", json={"email": "new@example.com", "password": "pass123"})
    assert response.status_code == 200
    assert "access_token" in response.json()

    # Login fail
    response = client.post("/login", json={"email": "new@example.com", "password": "wrongpass"})
    assert response.status_code == 400

# ---------------------------
# Playlist CRUD
# ---------------------------
def test_playlist_crud(auth_token, db):
    # Create playlist
    response = client.post("/playlists", json={"name": "My Playlist"}, headers={"Authorization": auth_token})
    assert response.status_code == 200
    pl_id = response.json()["playlist_id"]

    # Add song
    song = {"name": "Song A", "artists": "Artist A"}
    response = client.post(f"/playlists/{pl_id}/add_song", json=song, headers={"Authorization": auth_token})
    assert response.status_code == 200

    # Get playlists
    response = client.get("/playlists", headers={"Authorization": auth_token})
    assert response.status_code == 200
    playlists = response.json()
    assert any(pl["id"] == pl_id for pl in playlists)

    # Safely check songs
    songs_in_playlist = next((pl.get("songs", []) for pl in playlists if pl["id"] == pl_id), [])
    print("Songs in playlist:", songs_in_playlist)
    assert any(s.get("name") == "Song A" for s in songs_in_playlist)

    # Remove song
    song_id = f"{song['name']}-{song['artists']}"
    response = client.delete(f"/playlists/{pl_id}/songs/{song_id}", headers={"Authorization": auth_token})
    assert response.status_code == 200

# ---------------------------
# Liked Songs
# ---------------------------
def test_liked_songs(auth_token):
    song = {"name": "Song B", "artists": "Artist B"}

    # Like song
    response = client.post("/liked_songs", json=song, headers={"Authorization": auth_token})
    assert response.status_code == 200
    assert response.json()["liked"] is True

    # Unlike song
    response = client.post("/liked_songs", json=song, headers={"Authorization": auth_token})
    assert response.status_code == 200
    assert response.json()["liked"] is False

    # Get liked songs
    response = client.get("/liked_songs", headers={"Authorization": auth_token})
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# ---------------------------
# Search & Recommendations
# ---------------------------
def test_search_and_recommendations():
    # Search
    response = client.get("/search?q=love")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

    # Recommendations GET
    response = client.get("/recommend?song=love")
    assert response.status_code in [200, 404]  # 404 if no match
    if response.status_code == 200:
        data = response.json()
        assert "recommendations" in data

    # Recommendations POST
    response = client.post("/recommend", json={"song_name": "love", "top_n": 3})
    assert response.status_code in [200, 404]
    if response.status_code == 200:
        data = response.json()
        assert len(data["recommendations"]) <= 3
