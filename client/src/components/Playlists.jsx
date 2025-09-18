import React, { useEffect, useState } from "react";
import {
  api,
  fetchUserPlaylists,
  removeSongFromPlaylist,
  deletePlaylist,
} from "../api/api";
import RecommendationCard from "./RecommendationCard";

export default function Playlists({
  token,
  likedSongs,            // from App.js
  onLike,                // like toggle from App.js
  fetchPlaylists: parentFetchPlaylists, // optional refresh from App.js
  currentPlaying,        // App-level
  setCurrentPlaying,     // App-level
}) {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch playlists
  const fetchPlaylistsHandler = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchUserPlaylists(token); // ✅ pass token
      // ✅ normalize artwork for all songs
      const normalized = (data || []).map((pl) => ({
        ...pl,
        songs: (pl.songs || []).map((song) => ({
          ...song,
          artwork:
            song.artwork || song.image || song.cover || "/placeholder.png",
        })),
      }));
      setPlaylists(normalized);

      if (selectedPlaylist) {
        const updated = normalized.find((pl) => pl.id === selectedPlaylist.id);
        setSelectedPlaylist(updated || null);
      }
    } catch (err) {
      console.error("Error fetching playlists:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPlaylistsHandler();
  }, [token]);

  // Create new playlist
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setCreating(true);
    try {
      await api.post(
        "/playlists",
        { name: newPlaylistName },
        { headers: { Authorization: `Bearer ${token}` } } // ✅ include token
      );
      setNewPlaylistName("");
      await fetchPlaylistsHandler();
      if (parentFetchPlaylists) parentFetchPlaylists();
    } catch (err) {
      console.error("Error creating playlist:", err);
      alert("Failed to create playlist.");
    } finally {
      setCreating(false);
    }
  };

  // Remove a song from the selected playlist
  const handleRemoveSong = async (song) => {
    if (!token || !selectedPlaylist) return;
    const songId =
      song.id ||
      `${song.name}-${
        Array.isArray(song.artists) ? song.artists.join(",") : song.artists
      }`;
    setRemoving(true);
    try {
      await removeSongFromPlaylist(selectedPlaylist.id, songId, token); // ✅ pass token
      await fetchPlaylistsHandler();
      if (parentFetchPlaylists) parentFetchPlaylists();
    } catch (err) {
      console.error("Error removing song:", err);
      alert("Failed to remove song.");
    } finally {
      setRemoving(false);
    }
  };

  // ✅ Delete an entire playlist
  const handleDeletePlaylist = async () => {
    if (!token || !selectedPlaylist) return;
    if (!window.confirm(`Delete playlist "${selectedPlaylist.name}"?`)) return;
    setDeleting(true);
    try {
      await deletePlaylist(selectedPlaylist.id);
      setSelectedPlaylist(null); // go back after deleting
      await fetchPlaylistsHandler();
      if (parentFetchPlaylists) parentFetchPlaylists();
    } catch (err) {
      console.error("Error deleting playlist:", err);
      alert("Failed to delete playlist.");
    } finally {
      setDeleting(false);
    }
  };

  // Check if a song is liked
  const isSongLiked = (song) => {
    const songId =
      song.id ||
      `${song.name}-${
        Array.isArray(song.artists) ? song.artists.join(",") : song.artists
      }`;
    return likedSongs.some((s) => s.id === songId);
  };

  return (
    <div className="playlists-page">
      <h2>Your Playlists</h2>

      {/* Create playlist */}
      <div className="create-playlist">
        <input
          type="text"
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          placeholder="New playlist name"
        />
        <button onClick={handleCreatePlaylist} disabled={creating}>
          {creating ? "Creating…" : "Create Playlist"}
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : playlists.length === 0 ? (
        <p>You have no playlists yet.</p>
      ) : selectedPlaylist ? (
        <>
          <button onClick={() => setSelectedPlaylist(null)}>
            ← Back to Playlists
          </button>
          <h3>{selectedPlaylist.name}</h3>

          {/* ✅ Delete playlist button */}
          <button
            className="delete-btn"
            onClick={handleDeletePlaylist}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete Playlist"}
          </button>

          {selectedPlaylist.songs?.length === 0 ? (
            <p>No songs in this playlist yet.</p>
          ) : (
            <div className="recommendations">
              {selectedPlaylist.songs.map((song, idx) => (
                <RecommendationCard
                  key={`${song.id || song.name}-${idx}`}
                  song={song}
                  currentPlaying={currentPlaying}
                  setCurrentPlaying={setCurrentPlaying}
                  playlists={playlists}
                  token={token}
                  fetchPlaylists={fetchPlaylistsHandler}
                  onLike={onLike}
                  onRemove={handleRemoveSong}
                  isLiked={isSongLiked(song)}
                />
              ))}
            </div>
          )}
          {(removing || deleting) && <p>Updating playlist…</p>}
        </>
      ) : (
        <ul className="playlist-list">
          {playlists.map((pl) => (
            <li key={pl.id} onClick={() => setSelectedPlaylist(pl)}>
              {pl.name} ({pl.songs?.length || 0})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
