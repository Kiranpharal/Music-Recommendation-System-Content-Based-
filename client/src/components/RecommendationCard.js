// client/src/components/RecommendationCard.js
import React, { useState, useEffect } from "react";
import { addSongToPlaylist } from "../api/api";
import "./RecommendationCard.css";

const RecommendationCard = ({
  song = {},
  currentTrack,
  setCurrentTrack,
  playlists = [],
  token,
  fetchPlaylists,
  isLiked = false,
  onLike,
  onRemove,
}) => {
  const [adding, setAdding] = useState(false);
  const [playlistId, setPlaylistId] = useState("");
  const [localLiked, setLocalLiked] = useState(isLiked);

  useEffect(() => {
    setLocalLiked(isLiked);
  }, [isLiked]);

  const artistsText = Array.isArray(song.artists)
    ? song.artists.join(", ")
    : song.artists || "Unknown Artist";

  const backendId = song.id || null;

  const uiId =
    backendId ||
    `${song.name}-${Array.isArray(song.artists)
      ? song.artists.join(",")
      : song.artists}`;

  const isPlaying = currentTrack?.id === uiId;

  // -------------------------
  // PLAY HANDLER
  // -------------------------
  const handlePlay = () => {
    const hasPreview = !!song.preview;
    const hasYouTube = !!song.youtubeUrl;

    // Prefer audio preview
    if (hasPreview) {
      if (isPlaying) {
        setCurrentTrack(null);
      } else {
        setCurrentTrack({
          id: uiId,
          name: song.name,
          artists: artistsText,
          preview: song.preview,
          artwork: song.artwork || "/placeholder.png",
          youtubeUrl: song.youtubeUrl || null,
        });
      }
      return;
    }

    // Fallback → YouTube
    if (hasYouTube) {
      setCurrentTrack({
        id: uiId,
        name: song.name,
        artists: artistsText,
        preview: null,
        artwork: song.artwork || "/placeholder.png",
        youtubeUrl: song.youtubeUrl,
      });
      return;
    }

    alert("This track doesn't have a preview available.");
  };

  // -------------------------
  // LIKE HANDLER
  // -------------------------
  const handleLike = async () => {
    if (!token) return alert("Please sign in to save your favorite tracks.");
    try {
      await onLike(song);
    } catch (err) {
      console.error("Error liking song:", err);
      alert("Couldn't update your favorites.");
    }
  };

  // -------------------------
  // PLAYLIST ADD HANDLER
  // -------------------------
  const handleAddToPlaylist = async () => {
    if (!playlistId || !song) return;

    try {
      setAdding(true);
      await addSongToPlaylist(playlistId, song);
      setPlaylistId("");
      fetchPlaylists?.();
      alert("Added to your playlist!");
    } catch (err) {
      console.error(err);
      alert("Couldn't add this track to your playlist.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card">
      <img
        src={song.artwork || "/placeholder.png"}
        alt={song.name}
        className="album-img"
      />

      <h3>{song.name || "Untitled Track"}</h3>
      <p>{artistsText}</p>

      {song.cluster_mood && (
        <p className="mood">Vibe: {song.cluster_mood}</p>
      )}

      <div className="song-actions">
        {/* PLAY BUTTON */}
        <button onClick={handlePlay}>
          {song.preview
            ? isPlaying
              ? "⏸ Pause"
              : "▶️ Play"
            : "▶️ Preview"}
        </button>

        {/* LIKE */}
        {token && (
          <button onClick={handleLike}>
            {localLiked ? "❤️" : "🤍"}
          </button>
        )}

        {/* YOUTUBE BUTTON */}
        {song.youtubeUrl && (
          <button
            onClick={() =>
              window.open(song.youtubeUrl, "_blank", "noopener,noreferrer")
            }
          >
            Watch on YouTube
          </button>
        )}

        {/* REMOVE FROM LIST (playlists / favorites) */}
        {onRemove && (
          <button
            onClick={() => onRemove(song)}
            className="remove-button"
            title="Remove from this list"
          >
            🗑
          </button>
        )}

        {/* ADD TO PLAYLIST */}
        {!onRemove && playlists.length > 0 && (
          <>
            <select
              onChange={(e) => setPlaylistId(e.target.value)}
              value={playlistId}
            >
              <option value="">Add to playlist…</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              disabled={!playlistId || adding}
              onClick={handleAddToPlaylist}
            >
              ➕
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default RecommendationCard;
