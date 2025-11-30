import { useState } from "react";
import { adminCreateUser } from "../api/api";
import "./AdminCreate.css";

export default function AdminCreate() {
  const [username, setUsername] = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setLoading(true);

    try {
      await adminCreateUser(username, email, password);

      setMsg("Admin created successfully!");
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (e) {
      setError("Failed to create admin. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-create-container">
      <h1 className="admin-create-title">Create Admin</h1>

      {msg && <div className="admin-success">{msg}</div>}
      {error && <div className="admin-error">{error}</div>}

      <form className="admin-create-form" onSubmit={handleCreate}>
        <label>Username</label>
        <input
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label>Email</label>
        <input
          placeholder="Enter email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Password</label>
        <input
          placeholder="Enter password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="admin-create-btn" disabled={loading}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>
    </div>
  );
}
