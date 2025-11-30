// client/src/api/api.js
import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

// fallback
const DEFAULT_ARTWORK = "/placeholder.png";
const DEFAULT_PREVIEW = null;

// -----------------------------
// AXIOS INSTANCE
// -----------------------------
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// -----------------------------
// AUTH HEADER INJECTOR
// -----------------------------
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// -----------------------------
// SAFE JWT DECODER (no logic change, just safer)
// -----------------------------
const decodeJwt = (token) => {
  if (!token || typeof token !== "string") return {};
  try {
    const [, payload] = token.split(".");
    if (!payload) return {};

    // Handle URL-safe base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch (err) {
    console.error("Failed to decode JWT:", err);
    return {};
  }
};

// -----------------------------
// TOKEN AUTO-REFRESH
// -----------------------------
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      typeof original.url === "string" &&
      !original.url.includes("/login") &&
      !original.url.includes("/admin/login") &&
      !original.url.includes("/refresh-token")
    ) {
      original._retry = true;

      const refresh = localStorage.getItem("refreshToken");
      if (!refresh) return Promise.reject(error);

      try {
        const res = await axios.post(`${API_BASE_URL}/refresh-token`, {
          refresh_token: refresh,
        });

        localStorage.setItem("accessToken", res.data.access_token);
        localStorage.setItem("refreshToken", res.data.refresh_token);

        original.headers = original.headers || {};
        original.headers["Authorization"] = `Bearer ${res.data.access_token}`;
        return api(original);
      } catch (e) {
        console.error("Refresh token failed:", e);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("is_admin");
      }
    }

    return Promise.reject(error);
  }
);

// -----------------------------
// HELPERS
// -----------------------------
export const sanitizeSong = (song = {}) => ({
  ...song,
  artwork: song.artwork || DEFAULT_ARTWORK,
  preview: song.preview ?? DEFAULT_PREVIEW,
});

export const buildSongPayload = (song = {}) => {
  const artistsText = Array.isArray(song.artists)
    ? song.artists.join(", ")
    : song.artists || "";

  return {
    id: song.id || null,
    name: song.name || "",
    artists: artistsText,
    artwork: song.artwork || null,
    preview: song.preview || null,
    youtubeUrl: song.youtubeUrl || null,
    cluster_mood: song.cluster_mood || null,
    duration: song.duration || null,
    album: song.album || null,
    release_year: song.release_year ?? null,
    source: song.source || null,
  };
};

// -----------------------------
// USER LOGIN
// -----------------------------
export const loginUser = async (identifier, password) => {
  const res = await api.post("/login", { identifier, password });

  localStorage.setItem("accessToken", res.data.access_token);
  localStorage.setItem("refreshToken", res.data.refresh_token);

  const payload = decodeJwt(res.data.access_token);
  const isAdmin = payload.admin === true;

  if (isAdmin) {
    localStorage.setItem("is_admin", "true");
  } else {
    localStorage.removeItem("is_admin");
  }

  return {
    ...res.data,
    is_admin: isAdmin,
  };
};

// -----------------------------
// ADMIN LOGIN
// -----------------------------
export const adminLoginUser = async (identifier, password) => {
  const res = await api.post("/admin/login", { identifier, password });

  localStorage.setItem("accessToken", res.data.access_token);
  localStorage.setItem("refreshToken", res.data.refresh_token);
  localStorage.setItem("is_admin", "true");

  return res.data;
};

// -----------------------------
// PROFILE
// -----------------------------
export const registerUser = async (username, email, password) =>
  (await api.post("/register", { username, email, password })).data;

export const forgotPassword = async (email) =>
  (await api.post("/forgot-password", { email })).data;

export const resetPassword = async (token, newPassword) =>
  (
    await api.post("/reset-password", {
      token,
      new_password: newPassword,
    })
  ).data;

export const getMe = async () => (await api.get("/me")).data;

export const changePassword = async (oldPass, newPass) =>
  (
    await api.post("/change-password", {
      old_password: oldPass,
      new_password: newPass,
    })
  ).data;

export const updateUsername = async (username) =>
  (await api.post("/update-username", { username })).data;

export const updateEmail = async (email) =>
  (await api.post("/update-email", { email })).data;

// -----------------------------
// SEARCH & RECOMMENDATIONS
// -----------------------------
export const searchSongs = async (query, limit = 10) => {
  const res = await api.get("/search", { params: { q: query, limit } });
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(sanitizeSong);
};

export const getRecommendations = async (name, top_n = 10) => {
  const res = await api.get("/recommend", { params: { song: name, top_n } });

  const recs = Array.isArray(res.data?.recommendations)
    ? res.data.recommendations
    : [];

  return {
    input_song: res.data?.input_song ?? name,
    recommendations: recs.map(sanitizeSong),
  };
};

// -----------------------------
// PLAYLISTS
// -----------------------------
export const fetchUserPlaylists = async () => {
  const res = await api.get("/playlists");
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map((pl) => ({
    ...pl,
    songs: Array.isArray(pl.songs) ? pl.songs.map(sanitizeSong) : [],
  }));
};

export const createPlaylist = async (name) =>
  (await api.post("/playlists", { name })).data;

export const addSongToPlaylist = async (playlistId, song) =>
  (
    await api.post(
      `/playlists/${playlistId}/add_song`,
      buildSongPayload(song)
    )
  ).data;

export const removeSongFromPlaylist = async (playlistId, songId) =>
  (await api.delete(`/playlists/${playlistId}/songs/${songId}`)).data;

export const deletePlaylist = async (playlistId) =>
  (await api.delete(`/playlists/${playlistId}`)).data;

// -----------------------------
// LIKED SONGS
// -----------------------------
export const toggleLikeSong = async (song) =>
  (await api.post("/liked_songs", buildSongPayload(song))).data;

export const fetchLikedSongs = async () => {
  const res = await api.get("/liked_songs");
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(sanitizeSong);
};

// -----------------------------
// ADMIN FUNCTIONS
// -----------------------------
export const adminFetchUsers = async () =>
  (await api.get("/admin/users")).data;

export const adminStats = async () =>
  (await api.get("/admin/stats")).data;

export const adminUserStats = async (userId) =>
  (await api.get(`/admin/user_stats/${userId}`)).data;

export const adminCreateUser = async (username, email, password) =>
  (
    await api.post("/admin/create", {
      username,
      email,
      password,
    })
  ).data;

export const adminPromote = async (userId) =>
  (await api.post(`/admin/promote/${userId}`)).data;

export const adminDemote = async (userId) =>
  (await api.post(`/admin/demote/${userId}`)).data;

export const adminDeleteUser = async (userId) =>
  (await api.delete(`/admin/delete/${userId}`)).data;
