import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useFriends } from '@/lib/FriendsContext';
import { getMyDetailedPredictions } from '@/services/predictions';
import { getFavoriteClubs, removeFavoriteClub } from '@/services/favorites';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  User, Users, Trophy, Star, Target, Calendar, Mail, Clock,
  CheckCircle2, XCircle, TrendingUp, Heart, ChevronRight,
  Zap, Award, Shield, Flame, LogOut, Settings, Edit3,
  BarChart3, PieChart, Loader2, AlertCircle, Trash2
} from 'lucide-react';

// ============ Level Configuration ============
const LEVEL_THRESHOLDS = [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000];

const getLevelProgress = (points, level) => {
  const currentThreshold = LEVEL_THRESHOLDS[level] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const progress = ((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  return Math.min(100, Math.max(0, progress));
};

const getPointsToNextLevel = (points, level) => {
  const nextThreshold = LEVEL_THRESHOLDS[level + 1];
  if (!nextThreshold) return 0;
  return Math.max(0, nextThreshold - points);
};

// ============ Stat Card ============
const StatCard = memo(({ icon: Icon, label, value, color, subtext, onClick }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl border transition-all duration-300 ${
      onClick 
        ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:border-primary/40 active:scale-[0.98]' 
        : 'cursor-default'
    } bg-card border-border/50`}
    style={{ animationDelay: '0.1s' }}
    data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className={`flex items-center justify-center w-12 h-12 rounded-xl mb-3 ${color}`}>
      <Icon className="w-6 h-6" />
    </div>
    <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{value}</span>
    <span className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</span>
    {subtext && <span className="text-[10px] text-muted-foreground/60 mt-0.5">{subtext}</span>}
  </button>
));
StatCard.displayName = 'StatCard';

// ============ Achievement Badge ============
const AchievementBadge = memo(({ icon: Icon, title, description, unlocked, color }) => (
  <div
    className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
      unlocked 
        ? 'bg-card border-border/50 hover:border-primary/40' 
        : 'bg-muted/30 border-border/30 opacity-50'
    }`}
    data-testid={`achievement-${title.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
      unlocked ? color : 'bg-muted text-muted-foreground'
    }`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-semibold truncate ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
        {title}
      </p>
      <p className="text-xs text-muted-foreground truncate">{description}</p>
    </div>
    {unlocked && (
      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
    )}
  </div>
));
AchievementBadge.displayName = 'AchievementBadge';

// ============ Favorite Team Card ============
const FavoriteTeamCard = memo(({ team, onRemove, isRemoving }) => (
  <div
    className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-200 group"
    data-testid={`favorite-team-${team.team_id}`}
  >
    {team.team_crest ? (
      <img
        src={team.team_crest}
        alt={team.team_name}
        className="w-10 h-10 rounded-lg object-contain bg-secondary flex-shrink-0"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    ) : (
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-lg font-bold text-muted-foreground flex-shrink-0">
        {team.team_name?.charAt(0) || '?'}
      </div>
    )}
    <span className="flex-1 text-sm font-medium text-foreground truncate">{team.team_name}</span>
    <button
      onClick={() => onRemove(team.team_id)}
      disabled={isRemoving}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50"
      data-testid={`remove-favorite-${team.team_id}`}
    >
      {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  </div>
));
FavoriteTeamCard.displayName = 'FavoriteTeamCard';

// ============ Recent Activity Item ============
const RecentActivityItem = memo(({ prediction }) => {
  const isCorrect = prediction.result === 'correct';
  const isWrong = prediction.result === 'wrong';
  const isPending = prediction.result === 'pending';

  const predLabels = { home: '1', draw: 'X', away: '2' };
  const date = prediction.created_at 
    ? new Date(prediction.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';

  if (!prediction.match) return null;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
        isCorrect ? 'bg-emerald-500/[0.05] border-emerald-500/20' :
        isWrong ? 'bg-red-500/[0.05] border-red-500/20' :
        'bg-card border-border/50'
      }`}
      data-testid={`activity-${prediction.prediction_id}`}
    >
      {/* Result indicator */}
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
        isCorrect ? 'bg-emerald-500/15 text-emerald-400' :
        isWrong ? 'bg-red-500/15 text-red-400' :
        'bg-amber-500/15 text-amber-400'
      }`}>
        {isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
         isWrong ? <XCircle className="w-4 h-4" /> :
         <Clock className="w-4 h-4" />}
      </div>

      {/* Match info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {prediction.match.homeTeam?.name} vs {prediction.match.awayTeam?.name}
        </p>
        <p className="text-xs text-muted-foreground">{date} - Picked {predLabels[prediction.prediction]}</p>
      </div>

      {/* Points */}
      {prediction.points_awarded && prediction.points_value !== 0 && (
        <span className={`text-sm font-semibold flex-shrink-0 ${
          prediction.points_value > 0 ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {prediction.points_value > 0 ? '+' : ''}{prediction.points_value}
        </span>
      )}
    </div>
  );
});
RecentActivityItem.displayName = 'RecentActivityItem';

// ============ Friend Card ============
const FriendCard = memo(({ friend }) => {
  const initials = (friend.nickname || 'U').charAt(0).toUpperCase();
  
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-200"
      data-testid={`friend-${friend.user_id}`}
    >
      <Avatar className="w-10 h-10 border-2 border-background shadow flex-shrink-0">
        <AvatarImage src={friend.picture} alt={friend.nickname} />
        <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{friend.nickname}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            Lvl {friend.level || 0}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            {friend.points || 0}
          </span>
        </div>
      </div>
    </div>
  );
});
FriendCard.displayName = 'FriendCard';

// ============ Section Header ============
const SectionHeader = memo(({ icon: Icon, title, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    </div>
    {action}
  </div>
));
SectionHeader.displayName = 'SectionHeader';

// ============ Loading Skeleton ============
const ProfileSkeleton = () => (
  <div className="space-y-6 animate-pulse" data-testid="profile-skeleton">
    {/* Header skeleton */}
    <div className="bg-card rounded-xl border border-border/50 p-6">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-muted" />
        <div className="flex-1 text-center sm:text-left space-y-3">
          <div className="h-6 w-32 bg-muted rounded mx-auto sm:mx-0" />
          <div className="h-4 w-48 bg-muted rounded mx-auto sm:mx-0" />
          <div className="h-3 w-24 bg-muted rounded mx-auto sm:mx-0" />
        </div>
      </div>
    </div>
    {/* Stats skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border/50 p-5 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-muted mb-3" />
          <div className="h-7 w-12 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded mt-2" />
        </div>
      ))}
    </div>
  </div>
);

// ============ Main Profile Page ============
export const ProfilePage = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } = useAuth();
  const { friends, fetchFriends } = useFriends();
  const navigate = useNavigate();

  const [predictions, setPredictions] = useState([]);
  const [summary, setSummary] = useState({ correct: 0, wrong: 0, pending: 0, points: 0 });
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingFavorite, setRemovingFavorite] = useState(null);

  // Fetch user data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [predictionsData, favoritesData] = await Promise.all([
        getMyDetailedPredictions(),
        getFavoriteClubs()
      ]);

      setPredictions(predictionsData.predictions || []);
      setSummary(predictionsData.summary || { correct: 0, wrong: 0, pending: 0, points: 0 });
      setFavorites(favoritesData.favorites || []);

      // Refresh user and friends
      await Promise.all([refreshUser(), fetchFriends(true)]);
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser, fetchFriends]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchData();
    } else if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, fetchData, navigate]);

  // Handle remove favorite
  const handleRemoveFavorite = useCallback(async (teamId) => {
    setRemovingFavorite(teamId);
    try {
      await removeFavoriteClub(teamId);
      setFavorites(prev => prev.filter(f => f.team_id !== teamId));
      toast.success('Removed from favorites');
    } catch (error) {
      toast.error('Failed to remove favorite');
    } finally {
      setRemovingFavorite(null);
    }
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  // Calculate derived data
  const userPoints = user?.points ?? 0;
  const userLevel = user?.level ?? 0;
  const levelProgress = getLevelProgress(userPoints, userLevel);
  const pointsToNext = getPointsToNextLevel(userPoints, userLevel);
  const accuracy = summary.correct + summary.wrong > 0 
    ? Math.round((summary.correct / (summary.correct + summary.wrong)) * 100)
    : 0;
  const totalPredictions = predictions.length;

  // Recent predictions (last 5)
  const recentPredictions = predictions.slice(0, 5);

  // Achievements
  const achievements = [
    { icon: Target, title: 'First Prediction', description: 'Make your first prediction', unlocked: totalPredictions > 0, color: 'bg-primary/15 text-primary' },
    { icon: Flame, title: 'On Fire', description: 'Get 5 correct predictions', unlocked: summary.correct >= 5, color: 'bg-amber-500/15 text-amber-400' },
    { icon: Trophy, title: 'Champion', description: 'Reach Level 5', unlocked: userLevel >= 5, color: 'bg-yellow-500/15 text-yellow-400' },
    { icon: Award, title: 'Veteran', description: 'Make 50 predictions', unlocked: totalPredictions >= 50, color: 'bg-violet-500/15 text-violet-400' },
    { icon: Shield, title: 'Perfectionist', description: 'Achieve 80% accuracy', unlocked: accuracy >= 80 && totalPredictions >= 10, color: 'bg-emerald-500/15 text-emerald-400' },
    { icon: Heart, title: 'Fan', description: 'Add 3 favorite teams', unlocked: favorites.length >= 3, color: 'bg-red-500/15 text-red-400' },
  ];

  const displayName = user?.nickname || user?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const joinDate = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '';

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="profile-page">
        <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
        <main className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
          <ProfileSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="profile-page">
      <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      
      <main className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
        {/* ===== Profile Header Card ===== */}
        <div 
          className="relative overflow-hidden bg-card rounded-2xl border border-border/50 p-6 sm:p-8 mb-6 animate-fade-in"
          style={{ animationDelay: '0s' }}
          data-testid="profile-header"
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-amber-500/5 pointer-events-none" />
          
          <div className="relative flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-amber-400 to-primary rounded-full opacity-30 blur-sm group-hover:opacity-50 transition-opacity duration-500" />
              <Avatar className="relative w-24 h-24 sm:w-28 sm:h-28 border-4 border-background shadow-xl">
                <AvatarImage src={user?.picture} alt={displayName} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-3xl">{initials}</AvatarFallback>
              </Avatar>
              {/* Level badge */}
              <div className="absolute -bottom-1 -right-1 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 text-amber-950 text-xs font-bold shadow-lg">
                <Trophy className="w-3 h-3" />
                {userLevel}
              </div>
            </div>

            {/* User info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{displayName}</h1>
                {user?.auth_provider === 'google' && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">
                    Google
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3">{user?.email}</p>
              
              {/* Level progress */}
              <div className="space-y-2 max-w-xs mx-auto sm:mx-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Level {userLevel}</span>
                  <span className="text-primary font-medium">{userPoints} pts</span>
                </div>
                <div className="relative">
                  <Progress value={levelProgress} className="h-2 bg-muted" />
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
                {pointsToNext > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Zap className="w-3 h-3 inline mr-1 text-primary" />
                    {pointsToNext} pts to Level {userLevel + 1}
                  </p>
                )}
              </div>

              {/* Join date */}
              {joinDate && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-3 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>Joined {joinDate}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => navigate('/settings')}
                data-testid="profile-settings-btn"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
                data-testid="profile-logout-btn"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ===== Stats Grid ===== */}
        <div 
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
          data-testid="stats-grid"
        >
          <StatCard
            icon={Target}
            label="Predictions"
            value={totalPredictions}
            color="bg-primary/15 text-primary"
            onClick={() => navigate('/my-predictions')}
          />
          <StatCard
            icon={CheckCircle2}
            label="Correct"
            value={summary.correct}
            color="bg-emerald-500/15 text-emerald-400"
            subtext={accuracy > 0 ? `${accuracy}% accuracy` : undefined}
          />
          <StatCard
            icon={XCircle}
            label="Wrong"
            value={summary.wrong}
            color="bg-red-500/15 text-red-400"
          />
          <StatCard
            icon={Star}
            label="Points"
            value={userPoints}
            color="bg-amber-500/15 text-amber-400"
          />
        </div>

        {/* ===== Two Column Layout ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <div 
              className="bg-card rounded-xl border border-border/50 p-5 animate-fade-in"
              style={{ animationDelay: '0.2s' }}
              data-testid="recent-activity-section"
            >
              <SectionHeader 
                icon={BarChart3} 
                title="Recent Activity"
                action={
                  totalPredictions > 5 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary hover:text-primary gap-1"
                      onClick={() => navigate('/my-predictions')}
                    >
                      View all <ChevronRight className="w-4 h-4" />
                    </Button>
                  )
                }
              />
              
              {recentPredictions.length > 0 ? (
                <div className="space-y-2">
                  {recentPredictions.map((pred) => (
                    <RecentActivityItem key={pred.prediction_id} prediction={pred} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <Target className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">No predictions yet</p>
                  <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => navigate('/')}
                  >
                    Start Predicting
                  </Button>
                </div>
              )}
            </div>

            {/* Favorite Teams */}
            <div 
              className="bg-card rounded-xl border border-border/50 p-5 animate-fade-in"
              style={{ animationDelay: '0.3s' }}
              data-testid="favorites-section"
            >
              <SectionHeader 
                icon={Heart} 
                title="Favorite Teams"
                action={
                  <span className="text-xs text-muted-foreground">{favorites.length} teams</span>
                }
              />
              
              {favorites.length > 0 ? (
                <div className="space-y-2">
                  {favorites.map((team) => (
                    <FavoriteTeamCard
                      key={team.team_id}
                      team={team}
                      onRemove={handleRemoveFavorite}
                      isRemoving={removingFavorite === team.team_id}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <Heart className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">No favorite teams yet</p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate('/')}
                  >
                    Browse Matches
                  </Button>
                </div>
              )}
            </div>

            {/* Friends */}
            <div 
              className="bg-card rounded-xl border border-border/50 p-5 animate-fade-in"
              style={{ animationDelay: '0.35s' }}
              data-testid="friends-section"
            >
              <SectionHeader 
                icon={Users} 
                title="Friends"
                action={
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary hover:text-primary gap-1"
                    onClick={() => navigate('/friends')}
                  >
                    View all <ChevronRight className="w-4 h-4" />
                  </Button>
                }
              />
              
              {friends.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {friends.slice(0, 4).map((friend) => (
                    <FriendCard key={friend.user_id} friend={friend} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <Users className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">No friends yet</p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate('/friends')}
                  >
                    Find Friends
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Achievements */}
            <div 
              className="bg-card rounded-xl border border-border/50 p-5 animate-fade-in"
              style={{ animationDelay: '0.4s' }}
              data-testid="achievements-section"
            >
              <SectionHeader 
                icon={Award} 
                title="Achievements"
                action={
                  <span className="text-xs text-muted-foreground">
                    {achievements.filter(a => a.unlocked).length}/{achievements.length} unlocked
                  </span>
                }
              />
              
              <div className="space-y-2">
                {achievements.map((achievement) => (
                  <AchievementBadge key={achievement.title} {...achievement} />
                ))}
              </div>
            </div>

            {/* Performance Summary */}
            <div 
              className="bg-card rounded-xl border border-border/50 p-5 animate-fade-in"
              style={{ animationDelay: '0.5s' }}
              data-testid="performance-section"
            >
              <SectionHeader icon={PieChart} title="Performance" />
              
              <div className="space-y-4">
                {/* Win rate circle */}
                <div className="flex items-center justify-center py-4">
                  <div className="relative">
                    <svg className="w-32 h-32 -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="12"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="hsl(142 70% 45%)"
                        strokeWidth="12"
                        strokeDasharray={`${(accuracy / 100) * 352} 352`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-foreground">{accuracy}%</span>
                      <span className="text-xs text-muted-foreground">Win Rate</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Stats breakdown */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-emerald-400">{summary.correct}</p>
                    <p className="text-xs text-muted-foreground">Wins</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-400">{summary.wrong}</p>
                    <p className="text-xs text-muted-foreground">Losses</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-400">{summary.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>

                {/* Current streak placeholder */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-muted-foreground">Current Streak</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {summary.correct > 0 ? `${Math.min(summary.correct, 3)} wins` : 'Start predicting!'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProfilePage;
