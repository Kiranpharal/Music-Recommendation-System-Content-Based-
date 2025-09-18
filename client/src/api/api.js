// client/src/api/api.js
import axios from "axios";

// ----------------------------
// Default artwork & preview
// ----------------------------
const DEFAULT_ARTWORK = "https://example.com/default_artwork.png";
const DEFAULT_PREVIEW = null;

// ----------------------------
// Axios instance
// ----------------------------
export const api = axios.create({
  baseURL: "http://localhost:8000", // Change if backend deployed elsewhere
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Attach token automatically from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ----------------------------
// Helper: safe song object
// ----------------------------
const sanitizeSong = (song) => ({
  ...song,
  artwork: song.artwork || DEFAULT_ARTWORK,
  preview: song.preview || DEFAULT_PREVIEW,
});

// ----------------------------
// Recommendations
// ----------------------------
export const getRecommendations = async (songName, top_n = 10) => {
  try {
    const res = await api.get("/recommend", {
      params: { song: songName, top_n },
    });
    return {
      input_song: res.data.input_song,
      recommendations: res.data.recommendations.map(sanitizeSong),
    };
  } catch (err) {
    console.error("Error fetching recommendations:", err);
    throw err.response?.data || err;
  }
};

// ----------------------------
// Search
// ----------------------------
export const searchSongs = async (query, limit = 10) => {
  try {
    const res = await api.get("/search", { params: { q: query, limit } });
    return (res.data || []).map(sanitizeSong);
  } catch (err) {
    console.error("Error searching songs:", err);
    return [];
  }
};

// ----------------------------
// Playlists
// ----------------------------
export const fetchUserPlaylists = async () => {
  try {
    const res = await api.get("/playlists");
    return (res.data || []).map((pl) => ({
      ...pl,
      songs: pl.songs.map(sanitizeSong),
    }));
  } catch (err) {
    console.error("Error fetching playlists:", err);
    return [];
  }
};

export const createPlaylist = async (name) => {
  try {
    const res = await api.post("/playlists", { name });
    return res.data;
  } catch (err) {
    console.error("Error creating playlist:", err);
    throw err.response?.data || err;
  }
};

export const addSongToPlaylist = async (playlistId, song) => {
  try {
    const res = await api.post(`/playlists/${playlistId}/add_song`, song);
    return res.data;
  } catch (err) {
    console.error("Error adding song to playlist:", err);
    throw err.response?.data || err;
  }
};

export const removeSongFromPlaylist = async (playlistId, songId) => {
  try {
    const res = await api.delete(`/playlists/${playlistId}/songs/${songId}`);
    return res.data;
  } catch (err) {
    console.error("Error removing song from playlist:", err);
    throw err.response?.data || err;
  }
};

export const deletePlaylist = async (playlistId) => {
  try {
    const res = await api.delete(`/playlists/${playlistId}`);
    return res.data;
  } catch (err) {
    console.error("Error deleting playlist:", err);
    throw err.response?.data || err;
  }
};

// ----------------------------
// Liked Songs
// ----------------------------
export const toggleLikeSong = async (song) => {
  try {
    const res = await api.post("/liked_songs", song);
    return {
      ...res.data,
      song: sanitizeSong(song),
    };
  } catch (err) {
    console.error("Error toggling liked song:", err);
    throw err.response?.data || err;
  }
};

export const fetchLikedSongs = async () => {
  try {
    const res = await api.get("/liked_songs");
    return (res.data || []).map(sanitizeSong);
  } catch (err) {
    console.error("Error fetching liked songs:", err);
    return [];
  }
};

// ----------------------------
// Authentication
// ----------------------------
export const loginUser = async (email, password) => {
  try {
    const res = await api.post("/login", { email, password });
    return res.data; // { access_token, token_type }
  } catch (err) {
    console.error("Error logging in:", err);
    throw err.response?.data || err;
  }
};

export const registerUser = async (username, email, password) => {
  try {
    const res = await api.post("/register", { username, email, password });
    return res.data; // { message: "User registered successfully" }
  } catch (err) {
    console.error("Error registering user:", err);
    throw err.response?.data || err;
  }
};
