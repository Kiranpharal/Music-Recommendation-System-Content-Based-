// client/src/components/SearchBar.js
import React, { useState, useEffect } from "react";
import { searchSongs } from "../api/api";

const SearchBar = ({ onSongSelect }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await searchSongs(query, 8);
        setSuggestions(res || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSongSelect(query.trim());
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (song) => {
    const name = song.name || "";
    if (!name) return;
    setQuery(name);
    onSongSelect(name);
    setShowSuggestions(false);
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} style={{ width: "100%" }}>
        <input
          className="search-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Search for a song..."
          autoComplete="off"
        />
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map((s, idx) => (
            <li
              key={`${s.id || s.name}-${idx}`}
              onClick={() => handleSuggestionClick(s)}
            >
              {s.name} {s.artists ? `– ${s.artists}` : ""}
            </li>
          ))}
        </ul>
      )}

      {loading && <p className="loading">Searching…</p>}
    </div>
  );
};

export default SearchBar;
