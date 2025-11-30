// client/src/components/Sidebar.jsx
import React, { useState, useEffect } from "react";
import "./Sidebar.css";

const Sidebar = ({ activePage, setActivePage, onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
  }, [collapsed]);

  const navItems = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "recommendations", label: "Discover", icon: "🎧" },
    { id: "liked", label: "Favorites", icon: "❤️" },
    { id: "playlists", label: "My Playlists", icon: "📁" },
    { id: "profile", label: "Account", icon: "👤" },
  ];

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* HEADER */}
      <div className="sidebar-header">
        <span className="sidebar-logo">🎵</span>

        {!collapsed && (
          <h1 className="sidebar-title">TuneFlow</h1>
        )}

        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "➡️" : "⬅️"}
        </button>
      </div>

      {/* NAVIGATION */}
      <div className="sidebar-menu">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${
              activePage === item.id ? "active" : ""
            }`}
            onClick={() => setActivePage(item.id)}
            title={item.label}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-label">{item.label}</span>}
          </div>
        ))}
      </div>

      {/* FOOTER / SIGN OUT */}
      <div className="sidebar-footer">
        <div
          className="sidebar-item logout"
          onClick={onLogout}
          title="Sign out of TuneFlow"
        >
          <span className="sidebar-icon">🚪</span>
          {!collapsed && <span className="sidebar-label">Sign Out</span>}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
