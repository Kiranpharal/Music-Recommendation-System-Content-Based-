import { useState } from "react";
import { loginUser, adminLoginUser } from "../api/api";
import { Link, useNavigate } from "react-router-dom";
import "./AuthPage.css";

export default function Login({ onLoginSuccess, switchToRegister }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      // Try admin login first
      try {
        const adminRes = await adminLoginUser(identifier, password);

        if (onLoginSuccess)
          onLoginSuccess(adminRes.access_token, adminRes.refresh_token, true);

        navigate("/admin/dashboard");
        return;
      } catch (adminErr) {
        // fallback to normal login
      }

      // Normal user login
      const userRes = await loginUser(identifier, password);

      if (onLoginSuccess)
        onLoginSuccess(
          userRes.access_token,
          userRes.refresh_token,
          userRes.is_admin
        );

      if (userRes.is_admin) {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (e) {
      console.error(e);
      setErr(
        e?.response?.data?.detail ||
          "That doesn’t look right. Please check your details and try again."
      );
    }

    setLoading(false);
  };

  return (
    <div className="auth-form">
      <h2>Welcome Back</h2>

      <form onSubmit={submit}>
        <label>
          Email or Username
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter your email or username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </label>

        {err && <div className="auth-error">{err}</div>}

        <button disabled={loading}>
          {loading ? "Signing you in…" : "Sign In"}
        </button>
      </form>

      <div className="auth-forgot">
        <Link to="/forgot-password">Forgot your password?</Link>
      </div>

      <div className="auth-switch">
        <span>New to TuneFlow?</span>
        <button onClick={switchToRegister}>Create an account</button>
      </div>
    </div>
  );
}
