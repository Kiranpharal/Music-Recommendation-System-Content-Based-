// client/src/components/GlobalPlayer.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import "./GlobalPlayer.css";

const getYouTubeId = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1);
    }
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
};

const GlobalPlayer = ({ currentTrack, setCurrentTrack }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const hasAudio = !!currentTrack?.preview;
  const hasYouTube = !hasAudio && !!currentTrack?.youtubeUrl;

  const youtubeId = useMemo(
    () => (hasYouTube ? getYouTubeId(currentTrack.youtubeUrl) : null),
    [hasYouTube, currentTrack?.youtubeUrl]
  );

  // Set up audio when preview exists
  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !hasAudio || !currentTrack) return;

    audio.src = currentTrack.preview;
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", onEnded);
    };
  }, [hasAudio, currentTrack]);

  if (!currentTrack || (!hasAudio && !hasYouTube)) return null;

  const togglePlay = () => {
    if (!hasAudio) return; // controls only for audio mode

    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const handleSeek = (e) => {
    if (!hasAudio) return;

    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const pct = Number(e.target.value);
    audio.currentTime = (pct / 100) * audio.duration;
    setProgress(pct);
  };

  const handleClose = () => {
    if (hasAudio) {
      const audio = audioRef.current;
      if (audio) audio.pause();
    }
    setPlaying(false);
    setProgress(0);
    setCurrentTrack(null);
  };

  return (
    <>
      {/* Hidden audio element for preview-only mode */}
      <audio ref={audioRef} />

      <div className="global-player">
        <img
          src={currentTrack.artwork || "/placeholder.png"}
          alt="cover"
          className="gp-cover"
        />

        <div className="gp-info">
          <div className="gp-title">{currentTrack.name}</div>
          <div className="gp-artist">{currentTrack.artists}</div>
          {hasYouTube && <div className="gp-source">Playing from YouTube</div>}
        </div>

        {/* Controls for audio preview mode */}
        {hasAudio && (
          <>
            <button className="gp-play-btn" onClick={togglePlay}>
              {playing ? "⏸" : "▶️"}
            </button>

            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleSeek}
              className="gp-slider"
            />
          </>
        )}

        {/* Embedded YouTube player if no preview */}
        {hasYouTube && youtubeId && (
          <div className="gp-youtube-wrapper">
            <iframe
              title={currentTrack.name || "YouTube player"}
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              frameBorder="0"
            />
          </div>
        )}

        <button className="gp-close-btn" onClick={handleClose}>
          ✕
        </button>
      </div>
    </>
  );
};

export default GlobalPlayer;
