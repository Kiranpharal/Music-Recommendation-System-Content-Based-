import React, { useState, useEffect, useRef } from "react";

const SearchBar = ({ onSongSelect, token = null }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();

    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `http://localhost:8000/search?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        if (!res.ok) throw new Error("Failed to fetch suggestions");

        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Search error:", err);
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();

    return () => controller.abort(); // Cancel previous request on query change
  }, [query, token]);

  const handleSelect = (song) => {
    setQuery(song.name);       // Update input value immediately
    setSuggestions([]);        // Hide suggestions
    onSongSelect(song.name);   // Trigger recommendation fetch immediately
  };

  return (
    <div className="search-container">
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        placeholder="Search for a song..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading && <p className="loading">Loading suggestions…</p>}

      {suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map((song, idx) => (
            <li
              key={`${song.name}-${idx}`}
              onClick={() => handleSelect(song)}
            >
              {song.name} — {song.artists}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
