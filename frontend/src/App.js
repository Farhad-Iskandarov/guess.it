import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/lib/ThemeContext";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ChooseNicknamePage } from "@/pages/ChooseNicknamePage";
import { AuthCallback } from "@/pages/AuthCallback";
import { Loader2 } from "lucide-react";

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, requiresNickname } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to nickname page if needed (except if already there)
  if (requiresNickname && location.pathname !== '/choose-nickname') {
    return <Navigate to="/choose-nickname" replace />;
  }

  return children;
};

// App Router with auth callback detection
function AppRouter() {
  const location = useLocation();

  // Check URL fragment for session_id (Google OAuth callback)
  // This MUST be synchronous during render, not in useEffect
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Nickname selection (requires auth but not nickname) */}
      <Route path="/choose-nickname" element={<ChooseNicknamePage />} />
      
      {/* Home page - public but shows different UI based on auth */}
      <Route path="/" element={<HomePage />} />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
