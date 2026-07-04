import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Interview from "./components/Interview";
import Result from "./components/Result";
import AdminConsole from "./components/AdminConsole";
import { User, Skill, Question } from "./types";

type ScreenType = "LOGIN" | "DASHBOARD" | "INTERVIEW" | "RESULT" | "ADMIN";

export default function App() {
  const [screen, setScreen] = useState<ScreenType>("LOGIN");
  const [user, setUser] = useState<User | null>(null);
  const [preGeneratedQuestions, setPreGeneratedQuestions] = useState<Question[]>([]);
  
  // Custom Notification State
  const [notification, setNotification] = useState<string | null>(null);

  // Restore session from localstorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("chail_active_user");
    const storedScreen = localStorage.getItem("chail_active_screen");
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        if (parsedUser.is_admin === 1) {
          setScreen("ADMIN");
        } else if (storedScreen) {
          setScreen(storedScreen as ScreenType);
        } else {
          setScreen("DASHBOARD");
        }
      } catch (e) {
        console.error("Failed to restore cached user session:", e);
      }
    }
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 2800);
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    const targetScreen = loggedInUser.is_admin === 1 ? "ADMIN" : "DASHBOARD";
    setScreen(targetScreen);
    localStorage.setItem("chail_active_user", JSON.stringify(loggedInUser));
    localStorage.setItem("chail_active_screen", targetScreen);
  };

  const handleLogout = () => {
    setUser(null);
    setScreen("LOGIN");
    localStorage.removeItem("chail_active_user");
    localStorage.removeItem("chail_active_screen");
    showNotification("Logged out successfully! See you soon. 👋");
  };

  const handleStartInterview = (skills: Skill[], questions?: Question[]) => {
    if (questions && questions.length > 0) {
      setPreGeneratedQuestions(questions);
    } else {
      setPreGeneratedQuestions([]);
    }
    setScreen("INTERVIEW");
    localStorage.setItem("chail_active_screen", "INTERVIEW");
  };

  const handleInterviewComplete = () => {
    setScreen("RESULT");
    localStorage.setItem("chail_active_screen", "RESULT");
  };

  const handleRetry = () => {
    setScreen("DASHBOARD");
    localStorage.setItem("chail_active_screen", "DASHBOARD");
  };

  // Select view to render
  const renderScreen = () => {
    switch (screen) {
      case "LOGIN":
        return <Login onLoginSuccess={handleLoginSuccess} showNotification={showNotification} />;
      case "ADMIN":
        if (!user || user.is_admin !== 1) return <Login onLoginSuccess={handleLoginSuccess} showNotification={showNotification} />;
        return <AdminConsole user={user} onLogout={handleLogout} showNotification={showNotification} />;
      case "DASHBOARD":
        if (!user) return <Login onLoginSuccess={handleLoginSuccess} showNotification={showNotification} />;
        if (user.is_admin === 1) return <AdminConsole user={user} onLogout={handleLogout} showNotification={showNotification} />;
        return (
          <Dashboard
            user={user}
            onLogout={handleLogout}
            onStartInterview={handleStartInterview}
            showNotification={showNotification}
          />
        );
      case "INTERVIEW":
        if (!user) return <Login onLoginSuccess={handleLoginSuccess} showNotification={showNotification} />;
        if (user.is_admin === 1) return <AdminConsole user={user} onLogout={handleLogout} showNotification={showNotification} />;
        return (
          <Interview
            user={user}
            onLogout={handleLogout}
            onInterviewComplete={handleInterviewComplete}
            showNotification={showNotification}
            preGeneratedQuestions={preGeneratedQuestions}
          />
        );
      case "RESULT":
        if (!user) return <Login onLoginSuccess={handleLoginSuccess} showNotification={showNotification} />;
        if (user.is_admin === 1) return <AdminConsole user={user} onLogout={handleLogout} showNotification={showNotification} />;
        return <Result user={user} onRetry={handleRetry} showNotification={showNotification} />;
      default:
        return <Login onLoginSuccess={handleLoginSuccess} showNotification={showNotification} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#01040c]">
      {renderScreen()}

      {/* Floating System Notifications */}
      {notification && (
        <div className="notification">
          🎉 {notification}
        </div>
      )}
    </div>
  );
}
