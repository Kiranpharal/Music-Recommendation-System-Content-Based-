import React, { useState, useEffect } from "react";
import SearchBar from "./components/SearchBar";
import RecommendationCard from "./components/RecommendationCard";
import LikedSongs from "./components/LikedSongs";
import Playlists from "./components/Playlists";
import AuthPage from "./components/AuthPage";
import { 
  getRecommendations, 
  fetchUserPlaylists, 
  toggleLikeSong, 
  fetchLikedSongs as apiFetchLikedSongs, 
  api 
} from "./api/api";
import "./App.css";

function App() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [inputSong, setInputSong] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [showLogin, setShowLogin] = useState(!token);
  const [showRegister, setShowRegister] = useState(false);
  const [activePage, setActivePage] = useState("recommendations");

  // Fetch playlists
  const fetchPlaylists = async () => {
    if (!token) return;
    try {
      const playlists = await fetchUserPlaylists();
      setUserPlaylists(playlists || []);
    } catch (err) {
      console.error("Error fetching playlists:", err);
    }
  };

  // Fetch liked songs
  const fetchLikedSongs = async () => {
    if (!token) return;
    try {
      const songs = await apiFetchLikedSongs();
      setLikedSongs(songs || []);
    } catch (err) {
      console.error("Error fetching liked songs:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPlaylists();
      fetchLikedSongs();
    }
  }, [token]);

  // Handle song search
  const handleSongSelect = async (songName) => {
    if (!songName) return;
    setRecommendations([]);
    setError("");
    setLoading(true);
    setCurrentPlaying(null);
    setInputSong(songName);

    try {
      const data = await getRecommendations(songName, 10);
      const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
      setRecommendations(recs);
      setActivePage("recommendations");
      if (recs.length === 0) setError(`No recommendations found for "${songName}".`);
    } catch (e) {
      console.error(e);
      setError(e.message || "❌ Song not found in dataset");
    } finally {
      setLoading(false);
    }
  };

  // Login
  const handleLoginSuccess = (jwt) => {
    localStorage.setItem("token", jwt);
    setToken(jwt);
    setShowLogin(false);
    setShowRegister(false);
    setActivePage("recommendations");
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken("");
    setRecommendations([]);
    setUserPlaylists([]);
    setLikedSongs([]);
    setShowLogin(true);
    setShowRegister(false);
    setActivePage("recommendations");
  };

  // Check if song is liked
  const isSongLiked = (song) => {
    const songId = song.id || `${song.name}-${(Array.isArray(song.artists) ? song.artists.join(",") : song.artists)}`;
    return likedSongs.some((s) => s.id === songId);
  };

  // Like/unlike toggle
  const handleLikeToggle = async (song) => {
    if (!token) return alert("You must be logged in to like songs!");
    try {
      const res = await toggleLikeSong(song);
      const songId = song.id || `${song.name}-${(Array.isArray(song.artists) ? song.artists.join(",") : song.artists)}`;

      if (res.liked) {
        setLikedSongs((prev) => [...prev, { id: songId, ...song }]);
      } else {
        setLikedSongs((prev) => prev.filter((s) => s.id !== songId));
      }

      fetchPlaylists(); // refresh playlists
    } catch (err) {
      console.error("Error toggling like:", err);
      alert("Failed to update like status.");
    }
  };

  // Remove song from playlist
  const handleRemoveSongFromPlaylist = async (song, playlistId) => {
    if (!token || !playlistId) return;
    try {
      const songId = song.id || `${song.name}-${(Array.isArray(song.artists) ? song.artists.join(",") : song.artists)}`;
      await api.delete(`/playlists/${playlistId}/songs/${songId}`);
      fetchPlaylists();
      alert(`${song.name} removed from playlist`);
    } catch (err) {
      console.error("Error removing song from playlist:", err);
      alert("Failed to remove song from playlist");
    }
  };

  return (
    <div className="App">
      {!token ? (
        <AuthPage
          onLoginSuccess={handleLoginSuccess}
          showLogin={showLogin}
          showRegister={showRegister}
          setShowLogin={setShowLogin}
          setShowRegister={setShowRegister}
        />
      ) : (
        <>
          <nav className="user-nav">
            <button onClick={() => setActivePage("recommendations")} className={activePage === "recommendations" ? "active" : ""}>Recommendations</button>
            <button onClick={() => setActivePage("liked")} className={activePage === "liked" ? "active" : ""}>Liked Songs</button>
            <button onClick={() => setActivePage("playlists")} className={activePage === "playlists" ? "active" : ""}>Playlists</button>
            <button onClick={handleLogout}>Logout</button>
          </nav>

          <SearchBar onSongSelect={handleSongSelect} token={token} />

          {loading && <p className="loading">Loading recommendations…</p>}
          {error && !loading && <p className="error">{error}</p>}

          {activePage === "recommendations" && !loading && recommendations.length > 0 && (
            <>
              <h2 className="recommendation-heading">Recommended songs for: <em>{inputSong}</em></h2>
              <div className="recommendations">
                {recommendations.map((song, idx) => (
                  <RecommendationCard
                    key={song.id || `${song.name}-${idx}`}
                    song={song}
                    currentPlaying={currentPlaying}
                    setCurrentPlaying={setCurrentPlaying}
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

          {activePage === "liked" && token && (
            <LikedSongs
              token={token}
              likedSongs={likedSongs}
              currentPlaying={currentPlaying}
              setCurrentPlaying={setCurrentPlaying}
              onLike={handleLikeToggle}
              fetchLikedSongs={fetchLikedSongs}
            />
          )}

          {activePage === "playlists" && token && (
            <Playlists
              token={token}
              fetchPlaylists={fetchPlaylists}
              likedSongs={likedSongs}
              onLike={handleLikeToggle}
              onRemoveSong={handleRemoveSongFromPlaylist}
              currentPlaying={currentPlaying}
              setCurrentPlaying={setCurrentPlaying}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
