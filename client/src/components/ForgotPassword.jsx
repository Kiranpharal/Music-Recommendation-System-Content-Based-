import React, { useState } from "react";
import { forgotPassword } from "../api/api";
import "./AuthScreens.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;

    setLoading(true);
    setMsg("");

    try {
      const res = await forgotPassword(email);
      setMsg(res.message || "We've sent a reset link to your email.");
    } catch (err) {
      setMsg("We couldn’t send the reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <h2 className="auth-title">Forgot Your Password?</h2>

      <p className="auth-subtext">
        Enter your email and we’ll send you instructions to reset your password.
      </p>

      <input
        type="email"
        placeholder="Enter your email"
        className="auth-input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Sending…" : "Send Reset Link"}
      </button>

      {msg && <p className="auth-msg">{msg}</p>}
    </div>
  );
}
