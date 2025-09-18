import { useState } from "react";
import { registerUser, loginUser } from "../api/api";

export default function Register({ switchToLogin, onRegisterSuccess }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // ✅ Register the user
      await registerUser(username, email, password);

      // ✅ Auto-login after successful registration
      const res = await loginUser(email, password);
      const token = res.access_token;
      localStorage.setItem("token", token);
      onRegisterSuccess?.(token); // notify parent
    } catch (err) {
      const data = err.response?.data;
      if (data?.detail && Array.isArray(data.detail)) {
        setError(data.detail.map((e) => e.msg).join(", "));
      } else if (data?.detail) {
        setError(data.detail);
      } else if (data?.message) {
        setError(data.message);
      } else {
        setError("Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
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
          {loading ? "Registering…" : "Register"}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </form>
      <p className="auth-text">Already have an account?</p>
      <button className="link-btn" onClick={switchToLogin}>
        Login
      </button>
    </div>
  );
}
