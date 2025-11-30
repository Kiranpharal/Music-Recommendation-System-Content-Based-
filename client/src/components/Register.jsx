import { useState } from "react";
import { registerUser } from "../api/api";

export default function Register({ switchToLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await registerUser(username, email, password);

      setSuccess("Your account has been created! You can now sign in.");

      // Reset fields
      setUsername("");
      setEmail("");
      setPassword("");

      // Give the user a moment to read the message
      setTimeout(() => {
        if (switchToLogin) switchToLogin();
      }, 1200);

    } catch (err) {
      console.error(err);

      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "We couldn’t create your account. Please try again.";

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2>Create Your TuneFlow Account</h2>

      <form onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            placeholder="Create a password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <button type="submit" disabled={loading}>
          {loading ? "Creating your account…" : "Create Account"}
        </button>
      </form>

      <div className="auth-switch">
        <span>Already have an account?</span>
        <button type="button" onClick={switchToLogin}>
          Sign In
        </button>
      </div>
    </div>
  );
}
