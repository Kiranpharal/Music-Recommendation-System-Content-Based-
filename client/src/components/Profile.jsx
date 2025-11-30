// client/src/components/Profile.jsx
import React, { useEffect, useState } from "react";
import {
  getMe,
  changePassword,
  updateUsername,
  updateEmail,
} from "../api/api";
import "./Profile.css";

const Profile = () => {
  const [me, setMe] = useState(null);

  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const data = await getMe();
      setMe(data);
      setNewUsername(data.username);
      setNewEmail(data.email);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUsername = async () => {
    if (!newUsername.trim()) return;

    try {
      const res = await updateUsername(newUsername);
      setMsg(res.message || "Your username has been updated.");
      await loadUser();
    } catch (err) {
      setMsg(
        err?.response?.data?.detail ||
          "We couldn’t update your username. Please try again."
      );
    }
  };

  const handleEmail = async () => {
    if (!newEmail.trim()) return;

    try {
      const res = await updateEmail(newEmail);
      setMsg(res.message || "Your email has been updated.");
      await loadUser();
    } catch (err) {
      setMsg(
        err?.response?.data?.detail ||
          "We couldn’t update your email. Please try again."
      );
    }
  };

  const handlePassword = async () => {
    if (!oldPassword || !newPassword) return;

    try {
      const res = await changePassword(oldPassword, newPassword);
      setMsg(res.message || "Your password has been updated.");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setMsg(
        err?.response?.data?.detail ||
          "Password update failed. Please check your current password."
      );
    }
  };

  if (!me) return <p>Loading your profile…</p>;

  return (
    <div className="profile-page">
      <h2>Your Account</h2>
      <p className="profile-sub">Manage your TuneFlow profile and settings.</p>

      {/* ACCOUNT DETAILS */}
      <div className="profile-section">
        <h3>Account Details</h3>

        <p>
          <strong>Username:</strong> {me.username}
        </p>
        <p>
          <strong>Email:</strong> {me.email}
        </p>
        <p>
          <strong>Member Since:</strong>{" "}
          {new Date(me.created_at).toLocaleDateString()}
        </p>
        <p>
          <strong>Email Status:</strong>{" "}
          {me.is_verified ? "Verified ✔" : "Not Verified ✖"}
        </p>
        <p>
          <strong>Account Type:</strong> {me.is_admin ? "Admin" : "Standard User"}
        </p>
      </div>

      {/* UPDATE USERNAME */}
      <div className="profile-section">
        <h3>Update Username</h3>
        <input
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          placeholder="Enter new username"
        />
        <button onClick={handleUsername}>Save Username</button>
      </div>

      {/* UPDATE EMAIL */}
      <div className="profile-section">
        <h3>Update Email</h3>
        <input
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Enter new email address"
        />
        <button onClick={handleEmail}>Save Email</button>
      </div>

      {/* CHANGE PASSWORD */}
      <div className="profile-section">
        <h3>Change Password</h3>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="Current password"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
        />
        <button onClick={handlePassword}>Update Password</button>
      </div>

      {msg && <p className="profile-msg">{msg}</p>}
    </div>
  );
};

export default Profile;
