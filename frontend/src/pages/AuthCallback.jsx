import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * AuthCallback handles the Google OAuth callback.
 * It processes the session_id from the URL fragment and exchanges it for user data.
 */
export const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleGoogleCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const params = new URLSearchParams(hash.replace('#', ''));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          console.error('No session_id in callback URL');
          navigate('/login', { replace: true });
          return;
        }

        // Exchange session_id for user data
        const result = await handleGoogleCallback(sessionId);

        // Redirect based on whether nickname is set
        if (result.requires_nickname) {
          navigate('/choose-nickname', { replace: true });
        } else {
          navigate('/', { replace: true, state: { user: result.user } });
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', { replace: true });
      }
    };

    processCallback();
  }, [location, handleGoogleCallback, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Completing sign in...</p>
    </div>
  );
};

export default AuthCallback;
