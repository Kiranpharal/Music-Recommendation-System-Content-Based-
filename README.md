🎵 TuneFlow — AI-Powered Music Recommender

Full-stack music recommendation system built with React + FastAPI, featuring playlists, liked songs, JWT authentication, admin dashboard, and an ML-powered recommendation engine.

📁 Dataset Download

Download the full dataset used by the recommender:

👉 https://drive.google.com/file/d/1-TPyzmUNL0WvHse0j55s-R6sTaGKubAR/view?usp=sharing

Place it inside:

server/app/dataset/master_tracks.csv


The recommender loads this file internally.

🏛 Project Structure
TuneFlow/
│── client/                     # React frontend
│── server/
│   └── app/                    # FastAPI backend
│       ├── main.py             # Routes (auth, playlists, recommendations, admin)
│       ├── recommender.py      # ML engine
│       ├── models.py
│       ├── database.py
│       ├── auth.py
│       ├── email_utils.py
│       ├── utils.py
│       └── dataset/
│           └── master_tracks.csv
└── README.md

🚀 Features
🎧 AI Music Recommendations

Nearest-neighbor similarity search

150-cluster emotion-based grouping

iTunes preview fetch

YouTube fallback for preview-less tracks

Normalized audio features (energy, valence, tempo, etc.)

🔐 Authentication

Register + Email Verification

Login (username/email)

Refresh tokens

Forgot + Reset password

Update username/email/password

❤️ Liked Songs

Toggle like/unlike

Stored in database

Integrated global audio mini-player

📁 Playlists

Create/delete playlists

Add/remove tracks

Playlist modal UI

🛠 Admin Dashboard

Admin login

View all users

Promote/demote/delete users

Stats: playlists, liked songs, user activity

Secure admin-only routes

⚙️ Backend Setup (FastAPI)
Create virtual environment
cd server
python -m venv .venv
# Activate:
.venv\Scripts\activate      # Windows
source .venv/bin/activate  # Mac/Linux

Install dependencies
pip install -r requirements.txt

Run backend
uvicorn app.main:app --reload


Backend URL:

👉 http://localhost:8000

💻 Frontend Setup (React)
cd client
npm install
npm start


Frontend URL:

👉 http://localhost:3000

🔑 Environment Variables
server/.env
JWT_SECRET_KEY=yourkey1
JWT_REFRESH_SECRET_KEY=yourkey2
EMAIL_ENABLED=false

client/.env
REACT_APP_API_URL=http://localhost:8000

🧠 Recommender Engine Summary

Located in server/app/recommender.py

Loads + cleans dataset

Extracts audio features

Scales using custom MinMaxScaler

Clusters into 150 groups

Computes cosine similarity using NearestNeighbors

Fetches metadata from iTunes

Scrapes YouTube when iTunes preview missing

Returns full recommendation objects (artwork, preview, youtube link, mood cluster)

🔥 API Endpoints
Auth
POST /register
POST /login
POST /refresh-token
POST /forgot-password
POST /reset-password

User
GET /me
POST /change-password
POST /update-username
POST /update-email

Music
GET /search?q=
GET /recommend?song=

Playlists
GET /playlists
POST /playlists
POST /playlists/{id}/add_song
DELETE /playlists/{id}
DELETE /playlists/{id}/songs/{song_id}

Liked Songs
GET /liked_songs
POST /liked_songs

Admin
POST /admin/login
GET /admin/users
POST /admin/create
POST /admin/promote/{id}
POST /admin/demote/{id}
DELETE /admin/delete/{id}
GET /admin/stats
GET /admin/user_stats/{id}

💽 Database

SQLite database auto-creates:

users

playlists

playlist_songs

liked_songs

Models defined in:

server/app/models.py

📦 Build for Deployment
Frontend
npm run build

Backend

Run with uvicorn/gunicorn for production.

📝 License

Free to use for personal or academic purposes.
