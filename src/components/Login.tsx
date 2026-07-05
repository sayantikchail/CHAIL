import React, { useState } from "react";
import { User } from "../types";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  showNotification: (msg: string) => void;
}

export default function Login({ onLoginSuccess, showNotification }: LoginProps) {
  const [view, setView] = useState<"LOGIN" | "SIGNUP" | "ADMIN_SIGNUP" | "ADMIN_SIGNUP_VERIFY" | "ADMIN_LOGIN_VERIFY">("LOGIN");
  const [loading, setLoading] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminRegCode, setAdminRegCode] = useState("");
  const [adminLoginCode, setAdminLoginCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [admin2FaError, setAdmin2FaError] = useState<string | null>(null);

  const changeView = (v: typeof view) => {
    setView(v);
    setErrorMsg(null);
    setAdmin2FaError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!loginEmail || !loginPassword) {
      setErrorMsg("Please fill in all login fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.needs2FA) {
        showNotification("Admin detected. Loading 2FA Verification... 🔐");
        changeView("ADMIN_LOGIN_VERIFY");
      } else {
        showNotification("Welcome back! Login Successful! 🚀");
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!fullName || !signupEmail || !signupPassword) {
      setErrorMsg("Please fill all signup fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email: signupEmail,
          password: signupPassword,
          qualification: "B.A. (Hons.)",
          institution: "SVU",
          stream: "Education (Arts)",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      showNotification("Account Created Successfully! Please login now. ✨");
      changeView("LOGIN");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRegisterRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!adminName || !adminEmail || !adminPassword) {
      setErrorMsg("Please fill all fields.");
      return;
    }
    changeView("ADMIN_SIGNUP_VERIFY");
  };

  const verifyAdminRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!adminRegCode || adminRegCode.length < 4) {
      setErrorMsg("Please enter a valid verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword,
          code: adminRegCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Admin registration failed");
      }

      showNotification("Admin Account Created Successfully! 🛡️");
      changeView("LOGIN");
      // Reset fields
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminRegCode("");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmin2FaError(null);
    if (!adminLoginCode || adminLoginCode.length < 4) {
      setAdmin2FaError("Please enter a valid 2FA code.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          code: adminLoginCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Admin 2FA verification failed");
      }

      showNotification("Admin Access Granted! Welcome back. 🔑");
      onLoginSuccess(data.user);
    } catch (err: any) {
      setAdmin2FaError(err.message);
      setIsShaking(true);
      showNotification("⚠️ SECURITY ALERT: Admin 2FA Code Verification Failed! Please check your credentials.");
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <style>{`
        /* CSS Variables */
        :root {
          --bg1: #020024;
          --bg2: #001845;
          --bg3: #03045e;
          --glass: rgba(255, 255, 255, 0.09);
          --glass-2: rgba(255, 255, 255, 0.13);
          --border: rgba(255, 255, 255, 0.16);
          --text: #ffffff;
          --muted: #d7dce8;
          --cyan: #00ffff;
          --pink: #ff00ff;
          --blue: #0066ff;
          --shadow: 0 18px 60px rgba(0, 255, 255, 0.20);
          --radius: 32px;
        }

        .login-page-wrapper {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          background: radial-gradient(circle, rgba(0,255,255,0.22), transparent 28%), 
                      linear-gradient(135deg, var(--bg1), var(--bg2), var(--bg3));
          background-size: 200% 200%;
          animation: bgmove 10s ease-in-out infinite alternate;
          color: var(--text);
          padding: 18px;
          position: relative;
        }

        /* Background Orbs */
        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(8px);
          animation: float 8s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
        }
        .o1 { width: 250px; height: 250px; background: rgba(0, 255, 255, 0.28); top: -80px; left: -80px; }
        .o2 { width: 220px; height: 220px; background: rgba(255, 0, 255, 0.20); bottom: -70px; right: -70px; animation-delay: 3s; }
        .o3 { width: 120px; height: 120px; background: rgba(0, 255, 136, 0.20); left: 15%; bottom: 20%; animation-delay: 5s; }

        /* Main Container */
        .container {
          width: min(980px, 100%);
          max-height: 94vh;
          overflow-y: auto;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(22px);
          border: 1px solid var(--border);
          border-radius: 36px;
          padding: 34px;
          display: flex;
          gap: 28px;
          box-shadow: var(--shadow);
          transition: 0.35s ease;
          position: relative;
          z-index: 1;
        }
        .container:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 80px rgba(0, 255, 255, 0.26), 0 0 110px rgba(255, 0, 255, 0.10);
        }

        /* Left Section */
        .left {
          width: 50%;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .logo {
          font-size: 54px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 1px;
          transition: 0.3s ease;
          cursor: default;
        }
        .logo span {
          background: linear-gradient(90deg, var(--cyan), var(--pink));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .logo:hover {
          letter-spacing: 4px;
          text-shadow: 0 0 18px rgba(0, 255, 255, 0.8), 0 0 36px rgba(255, 0, 255, 0.5);
        }
        .tagline {
          margin-top: 12px;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.6;
        }

        /* Robot Animation Section */
        .robot { margin: 34px 0; display: flex; justify-content: center; }
        .ai-core {
          width: 168px;
          height: 168px;
          border-radius: 42px;
          background: linear-gradient(145deg, #081226, #001f3f);
          border: 1px solid rgba(0, 255, 255, 0.55);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 25px rgba(0, 255, 255, 0.55), 0 0 70px rgba(0, 102, 255, 0.35), inset 0 0 30px rgba(0, 255, 255, 0.18);
          animation: robot 3s ease-in-out infinite;
          transition: 0.35s ease;
        }
        .ai-core::before {
          content: "";
          position: absolute;
          top: 0;
          left: -120%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.40), transparent);
          transform: skewX(-25deg);
          animation: shine 3s infinite;
        }
        .ai-core:hover {
          animation: none;
          transform: perspective(500px) rotateY(14deg) scale(1.06);
          box-shadow: 0 0 40px rgba(0, 255, 255, 0.75), 0 0 90px rgba(255, 0, 255, 0.28);
        }
        .eye {
          width: 76px;
          height: 14px;
          background: var(--cyan);
          border-radius: 999px;
          box-shadow: 0 0 24px rgba(0, 255, 255, 0.85);
          margin-bottom: 16px;
          animation: blink 2s infinite;
          z-index: 1;
        }
        .ai-text {
          font-size: 54px;
          font-weight: 900;
          letter-spacing: 8px;
          background: linear-gradient(90deg, var(--cyan), var(--pink));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          z-index: 1;
        }

        /* Features Grid */
        .features {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 8px;
        }
        .feature {
          background: rgba(255, 255, 255, 0.09);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 16px;
          border-radius: 18px;
          transition: 0.3s ease;
          cursor: default;
          line-height: 1.5;
          color: #f8fbff;
        }
        .feature:hover {
          transform: translateY(-6px) scale(1.03);
          background: rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 22px rgba(0, 255, 255, 0.22);
        }

        /* Right Section & Form */
        .right {
          width: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card {
          width: 100%;
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.10);
          padding: 34px;
          border-radius: 30px;
          box-shadow: 0 0 30px rgba(0, 255, 255, 0.14);
          transition: 0.3s ease;
        }
        .card:hover { transform: scale(1.01); box-shadow: 0 0 42px rgba(0, 255, 255, 0.22); }
        
        h2 { text-align: center; font-size: 30px; margin-bottom: 8px; font-weight: bold; }
        .subtitle { text-align: center; font-size: 13px; color: var(--muted); margin-bottom: 24px; }
        
        .form-group { margin-bottom: 14px; }
        input {
          width: 100%;
          padding: 15px 16px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          outline: none;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 15px;
          transition: 0.25s ease;
        }
        input::placeholder { color: #eef6ff; opacity: 0.85; }
        input:hover { background: rgba(255, 255, 255, 0.16); }
        input:focus {
          border-color: var(--cyan);
          box-shadow: 0 0 0 4px rgba(0, 255, 255, 0.12), 0 0 18px rgba(0, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.18);
        }

        .v-code {
          letter-spacing: 12px;
          text-align: center;
          font-size: 24px;
          font-weight: 900;
          color: var(--cyan);
        }

        button.form-btn {
          width: 100%;
          padding: 15px;
          margin-top: 10px;
          border: none;
          border-radius: 20px;
          font-size: 17px;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(90deg, var(--cyan), var(--blue), var(--pink));
          cursor: pointer;
          transition: 0.3s ease;
          box-shadow: 0 10px 24px rgba(0, 102, 255, 0.24);
        }
        button.form-btn:hover {
          transform: translateY(-3px) scale(1.02);
          background: linear-gradient(135deg, #ffd27a 0%, #ffb347 25%, #ff8c00 60%, #ff5e00 100%);
          box-shadow: 0 10px 24px rgba(255, 140, 0, 0.42), 0 0 30px rgba(255, 94, 0, 0.22);
        }
        button.form-btn:active { transform: scale(0.97); }

        .switch { text-align: center; margin-top: 18px; color: #e8edf7; font-size: 14px; }
        .switch span { color: var(--cyan); font-weight: 800; cursor: pointer; transition: 0.2s ease; }
        .switch span:hover { text-shadow: 0 0 18px rgba(0, 255, 255, 0.75); }

        /* Animations */
        @keyframes float { 50% { transform: translateY(-45px); } }
        @keyframes blink { 50% { opacity: 0.22; } }
        @keyframes robot { 50% { transform: translateY(-12px); } }
        @keyframes shine { 100% { left: 150%; } }
        @keyframes bgmove { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }

        /* Premium stylish login error alert */
        .login-error-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 94, 94, 0.08);
          border: 1px dashed rgba(255, 0, 94, 0.5);
          border-left: 4px solid #ff005e;
          border-radius: 16px;
          padding: 14px 18px;
          color: #ff9ebb;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.5;
          margin-bottom: 20px;
          text-align: left;
          box-shadow: 0 4px 20px rgba(255, 0, 94, 0.15), inset 0 0 15px rgba(255, 0, 94, 0.05);
          backdrop-filter: blur(8px);
          animation: shake 0.4s ease-in-out;
        }

        .login-error-alert .error-icon {
          font-size: 18px;
          filter: drop-shadow(0 0 4px rgba(255, 0, 94, 0.6));
          flex-shrink: 0;
          animation: heart-pulse 1.8s infinite;
        }

        .login-error-alert .error-text {
          flex-grow: 1;
          letter-spacing: 0.3px;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }

        @keyframes heart-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }

        /* Responsive */
        @media (max-width: 860px) {
          .container { flex-direction: column; min-height: auto; }
          .left, .right { width: 100%; }
        }
        @media (max-width: 560px) {
          .container { padding: 20px; border-radius: 26px; }
          .card { padding: 22px; }
          .logo { font-size: 40px; }
          .features { grid-template-columns: 1fr; }
          h2 { font-size: 26px; }
          .ai-core { width: 140px; height: 140px; }
          .ai-text { font-size: 40px; }
        }
      `}</style>

      {/* Background Orbs */}
      <div className="orb o1"></div>
      <div className="orb o2"></div>
      <div className="orb o3"></div>

      <div className="container">
        {/* Left Info Side */}
        <div className="left">
          <div className="logo">Ch<span>AI</span>L</div>
          <div className="tagline">Your Personal AI Interview Partner 🚀</div>

          <div className="robot">
            <div className="ai-core">
              <div className="eye"></div>
              <div className="ai-text">SVU</div>
            </div>
          </div>

          <div className="features">
            <div className="feature">🎯<br />Mock Interview</div>
            <div className="feature">🧠<br />Smart AI</div>
            <div className="feature">📊<br />Career Score</div>
            <div className="feature">⚡<br />Instant Result</div>
          </div>
        </div>

        {/* Right Form Side */}
        <div className="right">
          <div className="card">
            {view === "LOGIN" && (
              /* Login Form */
              <form onSubmit={handleLogin} id="login">
                <h2>Welcome Back</h2>
                <div className="subtitle">Enter your credentials to continue</div>
                
                {errorMsg && (
                  <div className="login-error-alert">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{errorMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <input
                    type="email"
                    placeholder="Email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="form-btn">
                  {loading ? "Logging in..." : "Login 🚀"}
                </button>
                <div className="switch">
                  New User? <span onClick={() => changeView("SIGNUP")}>Create Account</span>
                </div>
                <div className="switch">
                  Admin? <span onClick={() => changeView("ADMIN_SIGNUP")}>Create Admin</span>
                </div>
              </form>
            )}

            {view === "SIGNUP" && (
              /* Signup Form */
              <form onSubmit={handleRegister} id="signup">
                <h2>Sign Up</h2>
                <div className="subtitle">Join our AI community today</div>
                
                {errorMsg && (
                  <div className="login-error-alert">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{errorMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="email"
                    placeholder="Email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    placeholder="Password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="form-btn">
                  {loading ? "Creating..." : "Create Account ✨"}
                </button>
                <div className="switch">
                  Already have an account? <span onClick={() => changeView("LOGIN")}>Login</span>
                </div>
              </form>
            )}

            {view === "ADMIN_SIGNUP" && (
              /* Admin Signup Form */
              <form onSubmit={handleAdminRegisterRequest} id="adminSignup">
                <h2>Admin Access</h2>
                <div className="subtitle">Create a new administrator account</div>
                
                {errorMsg && (
                  <div className="login-error-alert">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{errorMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Admin Name"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="email"
                    placeholder="Admin Email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    placeholder="Admin Password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="form-btn">
                  Request Admin Access 🛡️
                </button>
                <div className="switch">
                  Back to <span onClick={() => changeView("LOGIN")}>Login</span>
                </div>
              </form>
            )}

            {view === "ADMIN_SIGNUP_VERIFY" && (
              /* Admin Signup Verification UI */
              <form onSubmit={verifyAdminRegistration} id="adminSignupVerify">
                <h2>Admin Identity</h2>
                <div className="subtitle">Verification needed to create admin</div>
                
                {errorMsg && (
                  <div className="login-error-alert">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{errorMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <input
                    className="v-code"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={adminRegCode}
                    onChange={(e) => setAdminRegCode(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="form-btn">
                  {loading ? "Verifying..." : "Verify & Create 🛡️"}
                </button>
                <div className="switch">
                  <span onClick={() => changeView("ADMIN_SIGNUP")}>← Go Back</span>
                </div>
              </form>
            )}

            {view === "ADMIN_LOGIN_VERIFY" && (
              /* Admin Login Verification UI */
              <form onSubmit={verifyAdminLogin} id="adminLoginVerify" className={isShaking ? "shake-form" : ""} style={{ animation: isShaking ? "shake 0.5s ease" : "none" }}>
                <h2>Admin 2FA</h2>
                <div className="subtitle">Enter security code to access panel</div>

                {admin2FaError && (
                  <div style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#f87171",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    fontSize: "12px",
                    marginBottom: "16px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 15px rgba(239, 68, 68, 0.1)",
                    animation: "pulse 1.5s infinite"
                  }}>
                    <span>⚠️</span>
                    <div style={{ textAlign: "left" }}>{admin2FaError}</div>
                  </div>
                )}

                <div className="form-group">
                  <input
                    className="v-code"
                    type="text"
                    maxLength={12}
                    placeholder="SVUADMIN2FA"
                    value={adminLoginCode}
                    onChange={(e) => setAdminLoginCode(e.target.value)}
                    required
                    style={{
                      border: admin2FaError ? "2px solid #ef4444" : "1px solid var(--border)",
                      boxShadow: admin2FaError ? "0 0 10px rgba(239, 68, 68, 0.2)" : "none"
                    }}
                  />
                </div>
                <button type="submit" className="form-btn">
                  {loading ? "Authorizing..." : "Authorize Login 🔑"}
                </button>
                <div className="switch">
                  <span onClick={() => { changeView("LOGIN"); }}>← Back to Login</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
