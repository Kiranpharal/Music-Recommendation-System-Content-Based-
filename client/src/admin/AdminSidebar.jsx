import { Link, useLocation } from "react-router-dom";

export default function AdminSidebar() {
  const { pathname } = useLocation();

  const linkStyle = (path) => ({
    padding: "12px 20px",
    display: "block",
    color: pathname === path ? "#fff" : "#ccc",
    background: pathname === path ? "#1f2937" : "transparent",
    textDecoration: "none",
    borderRadius: "6px",
    marginBottom: "6px"
  });

  return (
    <div style={{
      width: "240px",
      background: "#111827",
      height: "100vh",
      padding: "20px",
      boxSizing: "border-box",
      position: "fixed",
      left: 0,
      top: 0
    }}>
      <h2 style={{ color: "white", marginBottom: "20px" }}>Admin Panel</h2>

      <Link to="/admin/dashboard" style={linkStyle("/admin/dashboard")}>
        Dashboard
      </Link>

      <Link to="/admin/users" style={linkStyle("/admin/users")}>
        Users
      </Link>

      <Link to="/admin/create" style={linkStyle("/admin/create")}>
        Create User
      </Link>
    </div>
  );
}
