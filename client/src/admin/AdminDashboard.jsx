// client/src/admin/AdminDashboard.jsx
import { useEffect, useState } from "react";
import { adminStats, adminFetchUsers, adminUserStats } from "../api/api";
import "./Admin.css";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [userRows, setUserRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const s = await adminStats();

        if (mounted && s) {
          setStats(s);
        }

        const users = await adminFetchUsers();
        const normalUsers = users.filter((u) => !u.is_admin);

        const rows = await Promise.all(
          normalUsers.map(async (u) => {
            try {
              const detail = await adminUserStats(u.id);
              return {
                id: u.id,
                username: u.username,
                email: u.email,
                playlists: detail.playlists,
                liked_songs: detail.liked_songs,
              };
            } catch {
              return {
                id: u.id,
                username: u.username,
                email: u.email,
                playlists: 0,
                liked_songs: 0,
              };
            }
          })
        );

        if (mounted) {
          setUserRows(rows);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load admin dashboard:", err);
        if (mounted) {
          setLoading(false);
          setStats({}); // prevents null crash
        }
      }
    };

    // small delay to allow layout + router hydration
    setTimeout(load, 50);

    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !stats) {
    return <h2 className="admin-loading">Loading admin dashboard…</h2>;
  }

  return (
    <div>
      <h1 className="admin-title">Admin Dashboard</h1>

      <div className="admin-cards">
        <div className="admin-card">
          <h3>Total Users</h3>
          <p>{stats.total_users ?? 0}</p>
        </div>

        <div className="admin-card">
          <h3>Admins</h3>
          <p>{stats.total_admins ?? 0}</p>
        </div>

        <div className="admin-card">
          <h3>Normal Users</h3>
          <p>{stats.normal_users ?? 0}</p>
        </div>

        <div className="admin-card">
          <h3>Playlists</h3>
          <p>{stats.total_playlists ?? 0}</p>
        </div>

        <div className="admin-card">
          <h3>Liked Songs</h3>
          <p>{stats.total_liked_songs ?? 0}</p>
        </div>
      </div>

      <h2 className="admin-subtitle">User Activity Overview</h2>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Playlists</th>
              <th>Liked Songs</th>
            </tr>
          </thead>
          <tbody>
            {userRows.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>{u.playlists}</td>
                <td>{u.liked_songs}</td>
              </tr>
            ))}
            {userRows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center" }}>
                  No non-admin users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
