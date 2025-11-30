import { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import "./AuthPage.css";

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="auth-page">

      {/* LEFT SIDE – Logo */}
      <div className="auth-left">
        <div className="auth-logo-wrap">
          <img
            src="/music.avif"
            alt="TuneFlow Logo"
            className="auth-logo"
          />
          <h1 className="auth-logo-title">TuneFlow</h1>
        </div>
      </div>

      {/* RIGHT SIDE – Login/Register Box */}
      <div className="auth-right">
        <div className="auth-card">
          {isLogin ? (
            <Login
              onLoginSuccess={onLoginSuccess}
              switchToRegister={() => setIsLogin(false)}
            />
          ) : (
            <Register switchToLogin={() => setIsLogin(true)} />
          )}
        </div>
      </div>
    </div>
  );
}
