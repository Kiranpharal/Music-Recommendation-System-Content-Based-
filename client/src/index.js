// client/src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./App";

// User pages
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";

// Admin pages
import AdminLogin from "./admin/AdminLogin";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminUsers from "./admin/AdminUsers";
import AdminCreate from "./admin/AdminCreate";

import "./index.css";

/* --------------------------------------------------------
   Admin logout helper
-------------------------------------------------------- */
const adminLogout = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("is_admin");
  window.location.href = "/admin/login";
};

/* --------------------------------------------------------
   Protect admin routes
-------------------------------------------------------- */
const AdminProtected = ({ children }) => {
  const isAdmin = localStorage.getItem("is_admin") === "true";
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
};

/* --------------------------------------------------------
   Clean SPA redirect:
   "/" now checks if admin → redirect to /admin/dashboard
-------------------------------------------------------- */
const AdminRedirect = () => {
  const isAdmin = localStorage.getItem("is_admin") === "true";

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <App />;
};

/* --------------------------------------------------------
   Render
-------------------------------------------------------- */
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <Routes>
      {/* ROOT → admin-aware redirect */}
      <Route path="/" element={<AdminRedirect />} />

      {/* User routes */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Admin login */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Admin protected pages */}
      <Route
        path="/admin/dashboard"
        element={
          <AdminProtected>
            <AdminLayout onLogout={adminLogout}>
              <AdminDashboard />
            </AdminLayout>
          </AdminProtected>
        }
      />

      <Route
        path="/admin/users"
        element={
          <AdminProtected>
            <AdminLayout onLogout={adminLogout}>
              <AdminUsers />
            </AdminLayout>
          </AdminProtected>
        }
      />

      <Route
        path="/admin/create"
        element={
          <AdminProtected>
            <AdminLayout onLogout={adminLogout}>
              <AdminCreate />
            </AdminLayout>
          </AdminProtected>
        }
      />
    </Routes>
  </BrowserRouter>
);
