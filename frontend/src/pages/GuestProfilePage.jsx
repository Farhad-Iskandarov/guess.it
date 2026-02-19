import { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, Trophy, Zap, Target, CheckCircle2, Calendar,
  MessageSquare, Circle, Loader2, ShieldAlert
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

// ============ Stat Card ============
const StatCard = memo(({ icon: Icon, iconColor, label, value }) => (
  <div className="bg-card rounded-xl border border-border/50 p-4 flex flex-col items-center text-center" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${iconColor}`}>
      <Icon className="w-5 h-5" />
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
  </div>
));
StatCard.displayName = 'StatCard';

// ============ Guest Profile Page ============
export const GuestProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`${API_URL}/api/friends/profile/${userId}`, { credentials: 'include' });
        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data.detail || 'Failed to load profile');
        }
        const data = await resp.json();
        setProfile(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    if (userId && isAuthenticated) fetchProfile();
  }, [userId, isAuthenticated]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  const handleMessage = useCallback(() => {
    if (profile) {
      navigate('/messages', {
        state: {
          openChat: {
            user_id: profile.user_id,
            nickname: profile.nickname,
            picture: profile.picture,
            is_online: profile.is_online,
            last_seen: profile.last_seen
          }
        }
      });
    }
  }, [profile, navigate]);

  const picSrc = profile?.picture?.startsWith('/') ? `${API_URL}${profile.picture}` : profile?.picture;
  const initials = (profile?.nickname || 'U').charAt(0).toUpperCase();
  const accuracy = profile?.total_predictions > 0
    ? Math.round((profile.correct_predictions / profile.total_predictions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background" data-testid="guest-profile-page">
      <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      <main className="container mx-auto px-4 md:px-6 py-8 max-w-2xl">
        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
            data-testid="back-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Friend Profile</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <ShieldAlert className="w-12 h-12 text-destructive/50 mb-3" />
            <p className="text-lg font-semibold text-foreground mb-1">Access Denied</p>
            <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/friends')}>
              Back to Friends
            </Button>
          </div>
        ) : profile ? (
          <div className="space-y-6 animate-fade-in">
            {/* Profile Header */}
            <div className="bg-card rounded-2xl border border-border/50 p-6" data-testid="profile-header">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                    <AvatarImage src={picSrc} alt={profile.nickname} />
                    <AvatarFallback className="bg-primary/15 text-primary font-bold text-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {profile.is_online !== null && (
                    <span className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-3 border-card ${
                      profile.is_online ? 'bg-emerald-500' : 'bg-zinc-400'
                    }`} />
                  )}
                </div>

                <h2 className="text-xl font-bold text-foreground mt-3" data-testid="profile-nickname">
                  {profile.nickname}
                </h2>

                <div className="flex items-center gap-2 mt-1">
                  {profile.is_online !== null && (
                    <span className={`text-xs ${profile.is_online ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {profile.is_online ? 'Online' : profile.last_seen ? `Last seen ${formatDate(profile.last_seen)}` : 'Offline'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Level {profile.level || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-primary" />
                    {profile.points || 0} pts
                  </span>
                  {profile.created_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Joined {formatDate(profile.created_at)}
                    </span>
                  )}
                </div>

                <Button
                  onClick={handleMessage}
                  className="mt-4 gap-2"
                  data-testid="profile-message-btn"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3" data-testid="profile-stats">
              <StatCard
                icon={Target}
                iconColor="bg-blue-500/10 text-blue-500"
                label="Predictions"
                value={profile.total_predictions || 0}
              />
              <StatCard
                icon={CheckCircle2}
                iconColor="bg-emerald-500/10 text-emerald-500"
                label="Correct"
                value={profile.correct_predictions || 0}
              />
              <StatCard
                icon={Trophy}
                iconColor="bg-amber-500/10 text-amber-500"
                label="Accuracy"
                value={`${accuracy}%`}
              />
            </div>

            {/* Guest notice */}
            <div className="bg-muted/30 rounded-xl border border-border/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                You are viewing this profile as a friend. Some information may be hidden based on privacy settings.
              </p>
            </div>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
};

export default GuestProfilePage;
