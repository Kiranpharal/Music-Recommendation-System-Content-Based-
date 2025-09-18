import React, { useEffect, useState } from "react";
import RecommendationCard from "./RecommendationCard";

export default function LikedSongs({
  token,
  likedSongs,         // parent likedSongs for display
  currentPlaying,
  setCurrentPlaying,
  onLike,             // parent like toggle
  fetchLikedSongs,    // optional refresh
}) {

  // Handle like/unlike toggle
  const handleLikeToggle = async (song) => {
    if (!token) return alert("You must be logged in to like songs!");
    try {
      const res = await onLike(song); // parent returns liked status
      // No local state update needed since likedSongs comes from parent
      if (fetchLikedSongs) fetchLikedSongs(); // optional refresh
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  return (
    <div className="liked-songs-page">
      <h2>Liked Songs</h2>
      {likedSongs.length === 0 ? (
        <p>You have no liked songs yet.</p>
      ) : (
        <div className="recommendations">
          {likedSongs.map((song, idx) => {
            const songId = song.id || `${song.name}-${(Array.isArray(song.artists) ? song.artists.join(",") : song.artists)}`;
            return (
              <RecommendationCard
                key={songId}
                song={song}
                currentPlaying={currentPlaying}
                setCurrentPlaying={setCurrentPlaying}
                token={token}
                fetchPlaylists={fetchLikedSongs} // refresh after like/unlike
                isLiked={true}
                onLike={handleLikeToggle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
