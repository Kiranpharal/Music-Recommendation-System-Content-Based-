import React, { useRef, useEffect, useState } from "react";
import YouTube from "react-youtube";
import { addSongToPlaylist } from "../api/api";
import "./RecommendationCard.css";

const RecommendationCard = ({
  song = {},
  currentPlaying,
  setCurrentPlaying,
  playlists = [],
  token,
  fetchPlaylists,
  isLiked = false,
  onLike,
  onRemove,
}) => {
  const audioRef = useRef(null);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const [adding, setAdding] = useState(false);
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(isLiked);

  const songId = song?.id || `${song?.name}-${Array.isArray(song?.artists) ? song.artists.join(",") : song?.artists}`;

  // Keep liked state synced
  useEffect(() => setLiked(isLiked), [isLiked]);

  // Pause other songs
  useEffect(() => {
    if (currentPlaying !== songId) {
      audioRef.current?.pause();
      youtubePlayer?.pauseVideo();
    }
  }, [currentPlaying, songId, youtubePlayer]);

  const togglePlay = () => {
    if (song.preview) {
      const audio = audioRef.current;
      if (!audio) return;
      if (currentPlaying === songId) {
        audio.pause();
        setCurrentPlaying(null);
      } else {
        setCurrentPlaying(songId);
        audio.play();
      }
    } else if (song.youtubeId && youtubePlayer) {
      if (currentPlaying === songId) {
        youtubePlayer.pauseVideo();
        setCurrentPlaying(null);
      } else {
        setCurrentPlaying(songId);
        youtubePlayer.playVideo();
      }
    }
  };

  const handleLike = async () => {
    if (!token || !onLike) return alert("You must be logged in!");
    setLiking(true);
    try {
      await onLike({ ...song, id: songId });
      setLiked((prev) => !prev);
    } finally {
      setLiking(false);
    }
  };

  const handleAddToPlaylist = async () => {
    if (!selectedPlaylist) return;
    setAdding(true);
    try {
      await addSongToPlaylist(selectedPlaylist, {
        id: songId,
        name: song?.name || "Unknown Song",
        artists: Array.isArray(song?.artists) ? song.artists.join(", ") : song?.artists || "Unknown Artist",
        preview: song?.preview || "",
        artwork: song?.artwork || "",
      });
      alert(`${song?.name || "Song"} added to playlist!`);
      setSelectedPlaylist("");
      fetchPlaylists?.();
    } catch (err) {
      console.error(err);
      alert("Failed to add to playlist.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = () => {
    if (!onRemove) return;
    if (window.confirm(`Remove "${song.name}" from playlist?`)) onRemove({ ...song, id: songId });
  };

  const songName = song?.name || "Unknown Song";
  const artistText = Array.isArray(song?.artists) ? song.artists.join(", ") : song?.artists || "Unknown Artist";

  return (
    <div className="card">
      <img src={song?.artwork || "/placeholder.png"} alt={songName} className="album-img" />
      <h3 className="song-name">{songName}</h3>
      <p className="artist"><strong>Artist:</strong> {artistText}</p>
      <p className="mood"><strong>Mood:</strong> {song?.cluster_mood || "Unknown"}</p>

      {/* Audio preview */}
      {song.preview && <audio ref={audioRef} src={song.preview} />}

      {/* Hidden YouTube player */}
      {!song.preview && song.youtubeId && (
        <YouTube
          videoId={song.youtubeId}
          opts={{ height: "0", width: "0", playerVars: { autoplay: 0 } }}
          onReady={(e) => setYoutubePlayer(e.target)}
        />
      )}

      <div className="song-actions">
        {/* Play button */}
        <button onClick={togglePlay} className="small-button">
          {currentPlaying === songId ? "⏸" : "▶️"}
        </button>

        {/* Like button */}
        {token && (
          <button onClick={handleLike} className="small-button" disabled={liking}>
            {liked ? "❤️" : "🤍"}
          </button>
        )}

        {/* Remove button */}
        {onRemove && token && (
          <button onClick={handleRemove} className="small-button remove-button">🗑</button>
        )}

        {/* Add to playlist */}
        {playlists.length > 0 && !onRemove && token && (
          <>
            <select
              className="small-select"
              value={selectedPlaylist}
              onChange={(e) => setSelectedPlaylist(e.target.value)}
            >
              <option value="">➕ Playlist</option>
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.name}</option>
              ))}
            </select>
            <button
              onClick={handleAddToPlaylist}
              className="small-button"
              disabled={adding || !selectedPlaylist}
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
