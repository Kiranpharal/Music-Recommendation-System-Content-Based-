import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/api";
import "./AuthScreens.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [newPass, setNewPass] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!newPass.trim()) return;

    setLoading(true);
    setMsg("");

    try {
      const res = await resetPassword(token, newPass);
      setMsg(res.message || "Your password has been updated!");
    } catch (err) {
      setMsg("We couldn’t reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <h2 className="auth-title">Create a New Password</h2>

      <p className="auth-subtext">
        Choose a strong password and keep it safe.
      </p>

      <input
        type="password"
        placeholder="Enter a new password"
        className="auth-input"
        value={newPass}
        onChange={(e) => setNewPass(e.target.value)}
      />

      <button className="auth-btn" onClick={handleReset} disabled={loading}>
        {loading ? "Updating…" : "Update Password"}
      </button>

      {msg && <p className="auth-msg">{msg}</p>}
    </div>
  );
}
