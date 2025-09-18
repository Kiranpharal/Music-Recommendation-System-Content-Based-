import { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import "./AuthPage.css";

export default function AuthPage({ onLoginSuccess }) {
  const [showLogin, setShowLogin] = useState(true);

  const switchToRegister = () => setShowLogin(false);
  const switchToLogin = () => setShowLogin(true);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {showLogin ? (
          <Login
            onLoginSuccess={onLoginSuccess}
            switchToRegister={switchToRegister}
          />
        ) : (
          <Register
            switchToLogin={switchToLogin}
            onRegisterSuccess={onLoginSuccess} // ✅ auto-login after register
          />
        )}
      </div>
    </div>
  );
}
