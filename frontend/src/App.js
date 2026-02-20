import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/lib/ThemeContext";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { FriendsProvider } from "@/lib/FriendsContext";
import { MessagesProvider } from "@/lib/MessagesContext";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ChooseNicknamePage } from "@/pages/ChooseNicknamePage";
import { AuthCallback } from "@/pages/AuthCallback";
import { MyPredictionsPage } from "@/pages/MyPredictionsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { FriendsPage } from "@/pages/FriendsPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { AdminPage } from "@/pages/AdminPage";
import { GuestProfilePage } from "@/pages/GuestProfilePage";
import { HowItWorksPage } from "@/pages/HowItWorksPage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { AboutPage } from "@/pages/AboutPage";
import { NewsPage } from "@/pages/NewsPage";
import { ContactPage } from "@/pages/ContactPage";
import { useState, useEffect, useRef } from "react";

// ============ Initial Loading Screen ============
function InitialLoadingScreen({ onReady }) {
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { isLoading: authLoading } = useAuth();
  const readyTriggered = useRef(false);
  const minTimeElapsed = useRef(false);

  // Minimum display time (1.2s) so animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      minTimeElapsed.current = true;
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Watch for auth to finish loading + min time
  useEffect(() => {
    if (readyTriggered.current) return;

    const checkReady = () => {
      if (!authLoading && minTimeElapsed.current) {
        readyTriggered.current = true;
        setFadeOut(true);
        setTimeout(() => {
          setHidden(true);
          if (onReady) onReady();
        }, 450);
      }
    };

    checkReady();
    const interval = setInterval(checkReady, 50);
    return () => clearInterval(interval);
  }, [authLoading, onReady]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[hsl(0,0%,8%)] transition-opacity duration-[450ms] ease-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      data-testid="initial-loading-screen"
    >
      {/* Ambient glow */}
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[hsl(142,70%,45%)] opacity-[0.06] blur-[100px] animate-[glow-breathe_3s_ease-in-out_infinite]" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-6 animate-[loader-entrance_0.8s_cubic-bezier(0.16,1,0.3,1)_forwards]">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(142,70%,45%)]/20 border border-[hsl(142,70%,45%)]/30 animate-[logo-pulse_2s_ease-in-out_infinite]">
            <span className="text-[hsl(142,70%,45%)] font-bold text-3xl">G</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-extrabold tracking-tight text-[hsl(142,70%,45%)]">GUESS</span>
            <span className="text-3xl font-extrabold tracking-tight text-white">IT</span>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-sm text-[hsl(0,0%,55%)] tracking-wide font-medium animate-[tagline-fade_1s_0.3s_cubic-bezier(0.16,1,0.3,1)_both]">
          Predict. Compete. Win.
        </p>

        {/* Progress bar */}
        <div className="w-48 h-[3px] rounded-full bg-white/[0.06] overflow-hidden animate-[tagline-fade_1s_0.4s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="h-full rounded-full bg-gradient-to-r from-[hsl(142,70%,45%)] to-[hsl(45,100%,50%)] animate-[progress-fill_1.4s_0.5s_cubic-bezier(0.4,0,0.2,1)_both]" />
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes loader-entrance {
          0% { opacity: 0; transform: translateY(16px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tagline-fade {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes progress-fill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes logo-pulse {
          0%, 100% { box-shadow: 0 0 0 0 hsla(142,70%,45%,0.3); }
          50% { box-shadow: 0 0 20px 4px hsla(142,70%,45%,0.15); }
        }
        @keyframes glow-breathe {
          0%, 100% { transform: scale(1); opacity: 0.06; }
          50% { transform: scale(1.15); opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}

// ============ Protected Route ============
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, requiresNickname } = useAuth();
  const location = useLocation();

  if (isLoading) return null; // Loading screen handles this now

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiresNickname && location.pathname !== '/choose-nickname') {
    return <Navigate to="/choose-nickname" replace />;
  }

  return children;
};

// ============ App Router ============
function AppRouter() {
  const location = useLocation();

  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/choose-nickname" element={<ChooseNicknamePage />} />
      <Route path="/my-predictions" element={<ProtectedRoute><MyPredictionsPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<ProtectedRoute><GuestProfilePage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/*" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ============ App Shell ============
function AppShell() {
  const [showLoader, setShowLoader] = useState(() => {
    // Only show on initial load (not on internal navigation)
    if (typeof window !== 'undefined') {
      const hasLoaded = sessionStorage.getItem('guessit-loaded');
      return !hasLoaded;
    }
    return true;
  });

  const handleReady = () => {
    sessionStorage.setItem('guessit-loaded', '1');
    setShowLoader(false);
  };

  return (
    <>
      {showLoader && <InitialLoadingScreen onReady={handleReady} />}
      <div className={`min-h-screen bg-background ${showLoader ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </div>
    </>
  );
}

// ============ Root App ============
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FriendsProvider>
          <MessagesProvider>
            <AppShell />
          </MessagesProvider>
        </FriendsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
