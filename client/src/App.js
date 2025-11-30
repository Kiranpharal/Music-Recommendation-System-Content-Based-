// client/src/App.js
import React, { useState, useEffect, useCallback } from "react";
import SearchBar from "./components/SearchBar";
import RecommendationCard from "./components/RecommendationCard";
import LikedSongs from "./components/LikedSongs";
import Playlists from "./components/Playlists";
import AuthPage from "./components/AuthPage";
import Sidebar from "./components/Sidebar";
import GlobalPlayer from "./components/GlobalPlayer";
import Profile from "./components/Profile";

import {
  getRecommendations,
  fetchUserPlaylists,
  toggleLikeSong,
  fetchLikedSongs as apiFetchLikedSongs,
} from "./api/api";

import "./App.css";

function App({ adminOnly = false }) {
  /* ---------------------- STATE ---------------------- */
  const [token, setToken] = useState(localStorage.getItem("accessToken") || "");
  const [isAdminFlag, setIsAdminFlag] = useState(
    localStorage.getItem("is_admin") === "true"
  );

  const isAuthenticated = !!token;

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputSong, setInputSong] = useState("");
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [activePage, setActivePage] = useState("home");
  const [currentTrack, setCurrentTrack] = useState(null);

  /* ---------------------- LOGIN SUCCESS ---------------------- */
  const handleLoginSuccess = useCallback(
    (accessToken, refreshToken, isAdmin) => {
      if (accessToken) {
        localStorage.setItem("accessToken", accessToken);
        setToken(accessToken);
      }
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }

      if (isAdmin) {
        localStorage.setItem("is_admin", "true");
        setIsAdminFlag(true);
        window.location.href = "/admin/dashboard";
        return;
      }

      // Normal user
      setIsAdminFlag(false);
      localStorage.removeItem("is_admin");
      setActivePage("home");
    },
    []
  );

  /* ---------------------- LOGOUT ---------------------- */
  const handleLogout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("is_admin");

    setToken("");
    setIsAdminFlag(false);
    setRecommendations([]);
    setUserPlaylists([]);
    setLikedSongs([]);
    setCurrentTrack(null);
    setInputSong("");
    setError("");
    setLoading(false);
    setActivePage("home");
  }, []);

  /* ---------------------- FETCH PLAYLISTS ---------------------- */
  const fetchPlaylists = useCallback(async () => {
    if (!token) return;
    try {
      const playlists = await fetchUserPlaylists();
      setUserPlaylists(Array.isArray(playlists) ? playlists : []);
    } catch (err) {
      console.error("Error fetching playlists:", err);
    }
  }, [token]);

  /* ---------------------- FETCH LIKED SONGS ---------------------- */
  const fetchLikedSongs = useCallback(async () => {
    if (!token) return;
    try {
      const songs = await apiFetchLikedSongs();
      setLikedSongs(Array.isArray(songs) ? songs : []);
    } catch (err) {
      console.error("Error fetching liked songs:", err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPlaylists();
      fetchLikedSongs();
    }
  }, [token, fetchPlaylists, fetchLikedSongs]);

  /* ---------------------- SEARCH / RECOMMEND ---------------------- */
  const handleSongSelect = async (songName) => {
    if (!songName) return;

    setRecommendations([]);
    setError("");
    setLoading(true);
    setCurrentTrack(null);
    setInputSong(songName);

    try {
      const data = await getRecommendations(songName, 10);
      const recs = Array.isArray(data.recommendations)
        ? data.recommendations
        : [];

      setRecommendations(recs);
      setActivePage("recommendations");

      if (recs.length === 0) {
        setError(`No matches found for “${songName}”. Try another track.`);
      }
    } catch (e) {
      console.error(e);
      setError("We couldn’t find that song. Please try a different title.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------- LIKE TOGGLE ---------------------- */
  const buildSongId = (song) => {
    return (
      song.id ||
      `${song.name}-${(
        Array.isArray(song.artists) ? song.artists.join(",") : song.artists
      )}`
    );
  };

  const isSongLiked = (song) => {
    const id = buildSongId(song);
    return likedSongs.some((s) => s.id === id);
  };

  const handleLikeToggle = async (song) => {
    if (!token) return alert("Sign in to save your favorite tracks.");

    try {
      const res = await toggleLikeSong(song);
      const id = buildSongId(song);

      if (res?.liked) {
        setLikedSongs((prev) =>
          prev.some((s) => s.id === id) ? prev : [...prev, { id, ...song }]
        );
      } else {
        setLikedSongs((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error(err);
      alert("We couldn’t update your favorites. Try again.");
    }
  };

  /* -------------------------------------------------------
     ADMIN-ONLY MODE
  ------------------------------------------------------- */
  if (adminOnly) {
    return (
      <AuthPage
        onLoginSuccess={(access, refresh, isAdmin) =>
          handleLoginSuccess(access, refresh, isAdmin)
        }
      />
    );
  }

  /* -------------------------------------------------------
     USER MODE — REQUIRE LOGIN
  ------------------------------------------------------- */
  if (!isAuthenticated) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  /* -------------------------------------------------------
     MAIN USER APPLICATION
  ------------------------------------------------------- */
  return (
    <>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={handleLogout}
      />

      <div className="App">
        <SearchBar onSongSelect={handleSongSelect} />

        {loading && <p className="loading">Finding great music for you…</p>}
        {error && !loading && <p className="error">{error}</p>}

        {/* ---------------- HOME ---------------- */}
        {activePage === "home" && (
          <div className="home-page">
            <h2>Welcome to TuneFlow</h2>
            <p className="home-sub">
              Search for any song and discover personalized recommendations powered by AI.
            </p>

            {likedSongs.length > 0 && (
              <>
                <h3 className="home-section-title">Your Favorites</h3>

                <div className="recommendations">
                  {likedSongs.slice(0, 4).map((song, idx) => (
                    <RecommendationCard
                      key={song.id || `${song.name}-${idx}`}
                      song={song}
                      currentTrack={currentTrack}
                      setCurrentTrack={setCurrentTrack}
                      playlists={userPlaylists}
                      token={token}
                      fetchPlaylists={fetchPlaylists}
                      isLiked={true}
                      onLike={handleLikeToggle}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ---------------- RECOMMENDATIONS ---------------- */}
        {activePage === "recommendations" &&
          !loading &&
          recommendations.length > 0 && (
            <>
              <h2 className="recommendation-heading">
                Recommendations based on <em>{inputSong}</em>
              </h2>

              <div className="recommendations">
                {recommendations.map((song, idx) => (
                  <RecommendationCard
                    key={song.id || `${song.name}-${idx}`}
                    song={song}
                    currentTrack={currentTrack}
                    setCurrentTrack={setCurrentTrack}
                    playlists={userPlaylists}
                    token={token}
                    fetchPlaylists={fetchPlaylists}
                    onLike={handleLikeToggle}
                    isLiked={isSongLiked(song)}
                  />
                ))}
              </div>
            </>
          )}

        {/* ---------------- LIKED SONGS ---------------- */}
        {activePage === "liked" && (
          <LikedSongs
            token={token}
            likedSongs={likedSongs}
            currentTrack={currentTrack}
            setCurrentTrack={setCurrentTrack}
            onLike={handleLikeToggle}
            fetchLikedSongs={fetchLikedSongs}
          />
        )}

        {/* ---------------- PLAYLISTS ---------------- */}
        {activePage === "playlists" && (
          <Playlists
            token={token}
            onLike={handleLikeToggle}
            fetchPlaylists={fetchPlaylists}
            currentTrack={currentTrack}
            setCurrentTrack={setCurrentTrack}
          />
        )}

        {/* ---------------- PROFILE ---------------- */}
        {activePage === "profile" && <Profile />}
      </div>

      <GlobalPlayer currentTrack={currentTrack} setCurrentTrack={setCurrentTrack} />
    </>
  );
}

export default App;
