import { useState } from "react";
import { loginUser } from "../api/api";

export default function Login({ onLoginSuccess, switchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // ✅ Pass email and password separately
      const res = await loginUser(email, password);
      const token = res.access_token;
      localStorage.setItem("token", token);
      onLoginSuccess(token); // notify parent about login
    } catch (err) {
      const data = err.response?.data;
      if (data?.detail && Array.isArray(data.detail)) {
        setError(data.detail.map((e) => e.msg).join(", "));
      } else if (data?.detail) {
        setError(data.detail);
      } else if (data?.message) {
        setError(data.message);
      } else {
        setError("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Login"}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </form>
      <p className="auth-text">Don't have an account?</p>
      <button className="link-btn" onClick={switchToRegister}>
        Register
      </button>
    </div>
  );
}
