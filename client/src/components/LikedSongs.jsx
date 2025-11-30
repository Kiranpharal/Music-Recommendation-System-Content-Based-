// client/src/components/LikedSongs.jsx
import React from "react";
import RecommendationCard from "./RecommendationCard";

export default function LikedSongs({
  token,
  likedSongs,
  currentTrack,
  setCurrentTrack,
  onLike,
  fetchLikedSongs,
}) {
  const handleLikeToggle = async (song) => {
    if (!token) {
      return alert("Please sign in to manage your favorite tracks.");
    }

    try {
      await onLike(song);
      await fetchLikedSongs();
    } catch (err) {
      console.error("Error updating favorites:", err);
    }
  };

  return (
    <div className="liked-songs-page">
      <h2>Your Favorite Tracks</h2>

      {likedSongs.length === 0 ? (
        <p className="empty-text">
          You haven’t saved any favorites yet. Explore music and tap ❤️ to add
          songs you love.
        </p>
      ) : (
        <div className="recommendations">
          {likedSongs.map((song, idx) => (
            <RecommendationCard
              key={song.id || `${song.name}-${idx}`}
              song={song}
              currentTrack={currentTrack}
              setCurrentTrack={setCurrentTrack}
              token={token}
              playlists={[]} // no playlists here but available for future expansion
              fetchPlaylists={null}
              isLiked={true}
              onLike={handleLikeToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
