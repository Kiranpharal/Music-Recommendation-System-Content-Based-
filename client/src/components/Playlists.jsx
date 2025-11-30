// client/src/components/Playlists.jsx
import React, { useEffect, useState } from "react";
import {
  fetchUserPlaylists,
  removeSongFromPlaylist,
  deletePlaylist,
  createPlaylist,
} from "../api/api";
import RecommendationCard from "./RecommendationCard";
import "./Playlists.css";

export default function Playlists({
  token,
  onLike,
  fetchPlaylists: parentFetchPlaylists,
  currentTrack,
  setCurrentTrack,
}) {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchPlaylistsHandler = async () => {
    if (!token) return;
    try {
      const data = await fetchUserPlaylists();
      setPlaylists(data || []);
    } catch (err) {
      console.error("Error fetching playlists:", err);
    }
  };

  useEffect(() => {
    if (token) fetchPlaylistsHandler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // CREATE PLAYLIST
  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;

    setCreating(true);
    try {
      await createPlaylist(name);
      setNewPlaylistName("");
      await fetchPlaylistsHandler();
      parentFetchPlaylists?.();
    } catch (err) {
      console.error("Error creating playlist:", err);
      alert("We couldn’t create your playlist. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // REMOVE SONG
  const handleRemoveSong = async (song) => {
    if (!token || !selectedPlaylist) return;

    setUpdating(true);
    try {
      await removeSongFromPlaylist(selectedPlaylist.id, song.id);

      // Refresh playlists + selected playlist
      await fetchPlaylistsHandler();
      const updated = (await fetchUserPlaylists()).find(
        (p) => p.id === selectedPlaylist.id
      );
      setSelectedPlaylist(updated || null);
    } catch (err) {
      console.error("Error removing song:", err);
      alert("We couldn’t remove this track. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  // DELETE PLAYLIST
  const handleDeletePlaylist = async () => {
    if (!selectedPlaylist) return;

    const yes = window.confirm(
      `Delete playlist “${selectedPlaylist.name}”? This can’t be undone.`
    );
    if (!yes) return;

    setUpdating(true);
    try {
      await deletePlaylist(selectedPlaylist.id);
      setSelectedPlaylist(null);
      await fetchPlaylistsHandler();
      parentFetchPlaylists?.();
    } catch (err) {
      console.error("Error deleting playlist:", err);
      alert("We couldn’t delete your playlist. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="playlists-page">
      <h2>Your Playlists</h2>

      {/* CREATE NEW PLAYLIST */}
      <div className="create-playlist">
        <input
          type="text"
          placeholder="Name your new playlist…"
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
        />
        <button onClick={handleCreatePlaylist} disabled={creating}>
          {creating ? "Creating…" : "Create"}
        </button>
      </div>

      {/* PLAYLIST LIST */}
      {playlists.length === 0 ? (
        <p className="empty-text">
          You haven’t created any playlists yet. Make your first one above and
          start building your sound.
        </p>
      ) : (
        <ul className="playlist-list">
          {playlists.map((pl) => (
            <li key={pl.id} onClick={() => setSelectedPlaylist(pl)}>
              {pl.name} ({pl.songs?.length || 0})
            </li>
          ))}
        </ul>
      )}

      {/* PLAYLIST DETAILS MODAL */}
      {selectedPlaylist && (
        <div
          className="playlist-modal-backdrop"
          onClick={() => setSelectedPlaylist(null)}
        >
          <div
            className="playlist-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="playlist-modal-header">
              <div>
                <h3>{selectedPlaylist.name}</h3>
                <p>{selectedPlaylist.songs?.length || 0} tracks</p>
              </div>

              <button
                className="delete-btn"
                onClick={handleDeletePlaylist}
                disabled={updating}
              >
                Delete Playlist
              </button>
            </div>

            {updating && <p>Updating playlist…</p>}

            <div className="playlist-songs-grid">
              {selectedPlaylist.songs?.length ? (
                selectedPlaylist.songs.map((song, idx) => (
                  <RecommendationCard
                    key={song.id || `${song.name}-${idx}`}
                    song={song}
                    currentTrack={currentTrack}
                    setCurrentTrack={setCurrentTrack}
                    playlists={[]}
                    token={token}
                    onLike={onLike}
                    isLiked={false}
                    onRemove={handleRemoveSong}
                  />
                ))
              ) : (
                <p>
                  This playlist is empty. Add some tracks and create your vibe.
                </p>
              )}
            </div>

            <button
              className="playlist-modal-close"
              onClick={() => setSelectedPlaylist(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
