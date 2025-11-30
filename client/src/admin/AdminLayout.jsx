// client/src/admin/AdminLayout.jsx
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./AdminLayout.css";

export default function AdminLayout({ children, onLogout }) {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const isAdmin = localStorage.getItem("is_admin") === "true";

    if (!token || !isAdmin) {
      navigate("/admin/login");
    }
  }, [navigate]);

  return (
    <div className="admin-container">

      {/* SIDEBAR */}
      <aside className="admin-sidebar">
        <h2 className="admin-logo">Admin</h2>

        <nav className="admin-nav">
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/users">Users</Link>
          <Link to="/admin/create">Create User</Link>
        </nav>

        <button className="admin-logout-btn" onClick={onLogout}>
          Logout
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-content">
        {children}
      </main>
    </div>
  );
}
