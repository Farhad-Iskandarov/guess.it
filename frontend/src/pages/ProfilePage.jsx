import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useFriends } from '@/lib/FriendsContext';
import { removeFavoriteClub } from '@/services/favorites';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  User, Users, Trophy, Star, Target, Calendar, Mail, Clock,
  CheckCircle2, XCircle, TrendingUp, Heart, ChevronRight,
  Zap, Award, Shield, Flame, LogOut, Settings, Edit3,
  BarChart3, PieChart, Loader2, AlertCircle, Trash2,
  Crown, Medal, Lock, Eye, ArrowUpDown, Filter, X,
  Crosshair, Brain, BadgeCheck, Gem, Percent, Gauge,
  ShieldCheck, Sparkles, HeartHandshake, ShieldHalf,
  UsersRound, UserPlus, Network, Swords
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

// ============ Icon Map for Achievements ============
const getIconComponent = (iconKey) => {
  const map = {
    // Predictions (Blue/Purple)
    crosshair: Crosshair, brain: Brain, target: Target,
    // Accuracy (Green)
    badge_check: BadgeCheck, medal: Medal, gem: Gem,
    percent: Percent, gauge: Gauge, shield_check: ShieldCheck,
    // Streaks (Orange/Red)
    flame: Flame, zap: Zap,
    // Level (Gold)
    star: Star, trophy: Trophy, crown: Crown, sparkles: Sparkles,
    // Favorites (Pink)
    heart: Heart, heart_handshake: HeartHandshake, shield_heart: ShieldHalf,
    // Social (Teal)
    user_plus: UserPlus, users_round: UsersRound, network: Network, users: Users,
    // Weekly (Amber)
    swords: Swords, award: Award,
    // Legacy fallbacks
    shield: Shield, check: CheckCircle2, chart: BarChart3, trending: TrendingUp,
  };
  return map[iconKey] || Award;
};

// Category-based color scheme
const CATEGORY_COLORS = {
  predictions: { bg: 'bg-blue-500/15', text: 'text-blue-400', bar: 'bg-blue-400', completed: 'text-blue-400', border: 'border-blue-500/30' },
  accuracy:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', bar: 'bg-emerald-400', completed: 'text-emerald-400', border: 'border-emerald-500/30' },
  streaks:     { bg: 'bg-orange-500/15', text: 'text-orange-400', bar: 'bg-orange-400', completed: 'text-orange-400', border: 'border-orange-500/30' },
  favorites:   { bg: 'bg-pink-500/15', text: 'text-pink-400', bar: 'bg-pink-400', completed: 'text-pink-400', border: 'border-pink-500/30' },
  social:      { bg: 'bg-teal-500/15', text: 'text-teal-400', bar: 'bg-teal-400', completed: 'text-teal-400', border: 'border-teal-500/30' },
  level:       { bg: 'bg-yellow-500/15', text: 'text-yellow-400', bar: 'bg-yellow-400', completed: 'text-yellow-400', border: 'border-yellow-500/30' },
  weekly:      { bg: 'bg-amber-500/15', text: 'text-amber-400', bar: 'bg-amber-400', completed: 'text-amber-400', border: 'border-amber-500/30' },
};

const getCategoryColor = (category) => CATEGORY_COLORS[category] || CATEGORY_COLORS.predictions;

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

// ============ Achievement Badge (Upgraded with Progress Bar) ============
const AchievementBadge = memo(({ achievement, compact = false, isHighlighted = false }) => {
  const IconComp = getIconComponent(achievement.icon);
  const isCompleted = achievement.completed;
  const isLocked = achievement.status === 'locked';
  const percentage = achievement.percentage || 0;
  const current = achievement.current || 0;
  const threshold = achievement.threshold || 1;
  const catColor = getCategoryColor(achievement.category);

  return (
    <div
      className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
        isHighlighted
          ? 'achievement-highlighted'
          : isCompleted
            ? `bg-card ${catColor.border} hover:border-opacity-80`
            : isLocked
              ? 'bg-muted/20 border-border/30 opacity-60'
              : 'bg-card border-border/50 hover:border-primary/30'
      }`}
      data-testid={`achievement-${achievement.id}`}
      data-achievement-id={achievement.id}
    >
      {/* Icon — category-colored */}
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${
        isCompleted ? `${catColor.bg} ${catColor.text}` :
        isLocked ? 'bg-muted text-muted-foreground' :
        `${catColor.bg} ${catColor.text}`
      }`}>
        {isLocked ? <Lock className="w-5 h-5" /> : <IconComp className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm font-semibold truncate ${
            isCompleted ? catColor.completed : isLocked ? 'text-muted-foreground' : 'text-foreground'
          }`}>
            {achievement.title}
          </p>
          {!compact && achievement.difficulty && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              achievement.difficulty === 1 ? 'bg-emerald-500/10 text-emerald-400' :
              achievement.difficulty === 2 ? 'bg-amber-500/10 text-amber-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              {achievement.difficulty === 1 ? 'Easy' : achievement.difficulty === 2 ? 'Medium' : 'Hard'}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mb-1.5">{achievement.description}</p>
        
        {/* Progress Bar — category-colored */}
        {!isCompleted && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  percentage > 0 ? catColor.bar : 'bg-muted-foreground/20'
                }`}
                style={{ width: `${percentage}%`, opacity: percentage >= 50 ? 1 : 0.7 }}
              />
            </div>
            <span className={`text-[10px] font-medium tabular-nums flex-shrink-0 ${
              percentage >= 50 ? catColor.text : 'text-muted-foreground'
            }`}>
              {current}/{threshold}
            </span>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <CheckCircle2 className={`w-5 h-5 ${catColor.completed}`} />
        ) : percentage >= 75 ? (
          <span className={`text-[10px] font-bold ${catColor.text} ${catColor.bg} px-1.5 py-0.5 rounded-full`}>{percentage}%</span>
        ) : null}
      </div>
    </div>
  );
});
AchievementBadge.displayName = 'AchievementBadge';


// ============ Achievements Modal ============
const AchievementsModal = memo(({ isOpen, onClose, achievements, completedCount, totalCount, highlightId }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('progress');
  const scrollRef = useRef(null);

  // Auto-scroll to highlighted achievement when modal opens
  useEffect(() => {
    if (!isOpen || !highlightId || !scrollRef.current) return;
    const timer = setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-achievement-id="${highlightId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350); // wait for modal animation
    return () => clearTimeout(timer);
  }, [isOpen, highlightId]);

  const filteredAndSorted = useMemo(() => {
    if (!achievements) return [];
    
    let filtered = [...achievements];
    if (activeTab === 'completed') {
      filtered = filtered.filter(a => a.completed);
    } else if (activeTab === 'uncompleted') {
      filtered = filtered.filter(a => !a.completed);
    }

    if (sortBy === 'progress') {
      filtered.sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        return b.percentage - a.percentage;
      });
    } else if (sortBy === 'category') {
      filtered.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    } else if (sortBy === 'difficulty') {
      filtered.sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0));
    }

    return filtered;
  }, [achievements, activeTab, sortBy]);

  const tabs = [
    { id: 'all', label: 'All', count: achievements?.length || 0 },
    { id: 'uncompleted', label: 'In Progress', count: (achievements?.length || 0) - completedCount },
    { id: 'completed', label: 'Completed', count: completedCount },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="achievements-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg max-h-[85vh] bg-card border border-border/50 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-300 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Achievements</h2>
              <p className="text-xs text-muted-foreground">
                {completedCount}/{totalCount} unlocked
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            data-testid="achievements-modal-close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-4 pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              data-testid={`modal-tab-${tab.id}`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 px-5 pb-3">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Sort:</span>
          {['progress', 'category', 'difficulty'].map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                sortBy === s
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`modal-sort-${s}`}
            >
              {s === 'progress' ? 'Progress' : s === 'category' ? 'Category' : 'Difficulty'}
            </button>
          ))}
        </div>

        {/* Achievement List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-5 space-y-2 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {filteredAndSorted.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              isHighlighted={achievement.id === highlightId}
            />
          ))}
          {filteredAndSorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <Award className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No achievements in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
AchievementsModal.displayName = 'AchievementsModal';


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

  const matchHome = prediction.match?.homeTeam?.name || `Match #${prediction.match_id}`;
  const matchAway = prediction.match?.awayTeam?.name || '';
  const matchLabel = matchAway ? `${matchHome} vs ${matchAway}` : matchHome;

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
          {matchLabel}
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
  <div className="space-y-6" data-testid="profile-skeleton">
    {/* Header skeleton */}
    <div className="bg-card rounded-2xl border border-border/50 p-6 sm:p-8 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full skeleton-bone" />
          <div className="absolute -bottom-1 -right-1 w-10 h-5 rounded-full skeleton-bone" />
        </div>
        <div className="flex-1 text-center sm:text-left space-y-3 w-full">
          <div className="h-7 w-40 skeleton-bone mx-auto sm:mx-0" />
          <div className="h-4 w-52 skeleton-bone mx-auto sm:mx-0" />
          <div className="space-y-2 max-w-xs mx-auto sm:mx-0">
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 skeleton-bone" />
              <div className="h-3 w-14 skeleton-bone" />
            </div>
            <div className="h-2 w-full skeleton-bone rounded-full" />
            <div className="h-3 w-28 skeleton-bone" />
          </div>
          <div className="h-3 w-24 skeleton-bone mx-auto sm:mx-0 mt-3" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-9 w-24 skeleton-bone rounded-md" />
          <div className="h-9 w-24 skeleton-bone rounded-md" />
        </div>
      </div>
    </div>
    {/* Stats skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border/50 p-5 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl skeleton-bone mb-3" />
          <div className="h-8 w-14 skeleton-bone rounded" />
          <div className="h-4 w-20 skeleton-bone rounded mt-2" />
        </div>
      ))}
    </div>
    {/* Two column skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg skeleton-bone" />
            <div className="h-5 w-28 skeleton-bone" />
          </div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/30">
                <div className="w-8 h-8 rounded-lg skeleton-bone flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 skeleton-bone" />
                  <div className="h-3 w-1/2 skeleton-bone" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg skeleton-bone" />
            <div className="h-5 w-28 skeleton-bone" />
          </div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/30">
                <div className="w-10 h-10 rounded-lg skeleton-bone flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 skeleton-bone" />
                  <div className="h-3 w-36 skeleton-bone" />
                  <div className="h-1.5 w-full skeleton-bone rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg skeleton-bone" />
            <div className="h-5 w-28 skeleton-bone" />
          </div>
          <div className="flex items-center justify-center py-4">
            <div className="w-32 h-32 rounded-full skeleton-bone" />
          </div>
          <div className="h-px w-full skeleton-bone my-4" />
          <div className="grid grid-cols-3 gap-3 text-center">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-6 w-8 skeleton-bone" />
                <div className="h-3 w-12 skeleton-bone" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============ Main Profile Page ============
export const ProfilePage = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } = useAuth();
  const { friends, fetchFriends } = useFriends();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [predictions, setPredictions] = useState([]);
  const [summary, setSummary] = useState({ correct: 0, wrong: 0, pending: 0, points: 0 });
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingFavorite, setRemovingFavorite] = useState(null);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState([]);
  const [myFriendsRank, setMyFriendsRank] = useState(null);

  // Achievements state
  const [achievementsDisplay, setAchievementsDisplay] = useState([]);
  const [achievementsAll, setAchievementsAll] = useState([]);
  const [achievementsCompleted, setAchievementsCompleted] = useState(0);
  const [achievementsTotal, setAchievementsTotal] = useState(0);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [highlightAchievementId, setHighlightAchievementId] = useState(null);
  const deepLinkHandled = useRef(false);

  // Single bundle fetch — all data in one call, all DB queries parallelized server-side
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/profile/bundle`, {
        credentials: 'include',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(res.status === 401 ? 'auth' : 'Failed to load profile');
      const data = await res.json();

      const p = data.predictions || {};
      setPredictions(p.predictions || []);
      setSummary(p.summary || { correct: 0, wrong: 0, pending: 0, points: 0 });
      setFavorites((data.favorites || {}).favorites || []);

      const lb = data.friends_leaderboard || {};
      setFriendsLeaderboard(lb.leaderboard || []);
      setMyFriendsRank(lb.my_rank);

      // Achievements
      const ach = data.achievements || {};
      setAchievementsDisplay(ach.display || []);
      setAchievementsAll(ach.all || []);
      setAchievementsCompleted(ach.completed_count || 0);
      setAchievementsTotal(ach.total_count || 0);

      setIsLoading(false);

      // Background: refresh user + friends (non-blocking, won't affect UI state)
      refreshUser().catch(() => {});
      fetchFriends(true).catch(() => {});
    } catch (err) {
      if (err.message === 'auth') {
        navigate('/login');
        return;
      }
      console.error('Profile fetch failed:', err);
      setError('Failed to load profile. Please try again.');
      setIsLoading(false);
    }
  }, [refreshUser, fetchFriends, navigate]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchData();
    } else if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, fetchData, navigate]);

  // Deep-link: auto-open achievements modal and highlight specific achievement
  useEffect(() => {
    if (isLoading || deepLinkHandled.current) return;
    const section = searchParams.get('section');
    const highlight = searchParams.get('highlight');
    if (section === 'achievements') {
      deepLinkHandled.current = true;
      setHighlightAchievementId(highlight || null);
      setShowAchievementsModal(true);
      // Clean up URL params after handling (keep URL clean)
      setSearchParams({}, { replace: true });
      // Clear highlight after animation completes
      if (highlight) {
        setTimeout(() => setHighlightAchievementId(null), 3500);
      }
    }
  }, [isLoading, searchParams, setSearchParams]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-background" data-testid="profile-page">
        <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
        <main className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
          <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="profile-error-state">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Failed to load profile</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">{error}</p>
            <Button
              onClick={fetchData}
              className="gap-2"
              data-testid="retry-btn"
            >
              <Loader2 className="w-4 h-4" />
              Try Again
            </Button>
          </div>
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
          className="relative overflow-hidden bg-card rounded-2xl border border-border/50 p-6 sm:p-8 mb-6 content-fade-in"
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
            onClick={() => navigate('/my-predictions?filter=correct')}
          />
          <StatCard
            icon={XCircle}
            label="Wrong"
            value={summary.wrong}
            color="bg-red-500/15 text-red-400"
            onClick={() => navigate('/my-predictions?filter=wrong')}
          />
          <StatCard
            icon={Star}
            label="Points"
            value={userPoints}
            color="bg-amber-500/15 text-amber-400"
            onClick={() => navigate('/my-predictions?filter=points')}
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
                <div className="max-h-[280px] overflow-y-auto overscroll-contain space-y-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
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
            {/* ===== Achievements (Smart Display) ===== */}
            <div 
              className="bg-card rounded-xl border border-border/50 p-5 animate-fade-in"
              style={{ animationDelay: '0.4s' }}
              data-testid="achievements-section"
            >
              <SectionHeader 
                icon={Award} 
                title="Achievements"
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {achievementsCompleted}/{achievementsTotal} unlocked
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary gap-1 h-7 px-2"
                      onClick={() => setShowAchievementsModal(true)}
                      data-testid="view-all-achievements-btn"
                    >
                      View All <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                }
              />
              
              <div className="space-y-2">
                {achievementsDisplay.length > 0 ? (
                  achievementsDisplay.map((achievement) => (
                    <AchievementBadge
                      key={achievement.id}
                      achievement={achievement}
                      compact
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                      <Award className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">Start playing to unlock achievements!</p>
                  </div>
                )}
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

          {/* ===== My Leaderboard (Friends) — Full Width ===== */}
          <div className="col-span-1 lg:col-span-2">
            <div 
              className="bg-card rounded-xl border border-border/50 p-5 animate-fade-in"
              style={{ animationDelay: '0.36s' }}
              data-testid="friends-leaderboard-section"
            >
              <SectionHeader 
                icon={Trophy} 
                title="My Leaderboard"
                action={
                  myFriendsRank && (
                    <span className="text-xs text-primary font-semibold">
                      Your rank: #{myFriendsRank}
                    </span>
                  )
                }
              />
              
              {friendsLeaderboard.length > 1 ? (
                <div className="space-y-1.5">
                  {friendsLeaderboard.map((entry) => (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                        entry.is_me
                          ? 'bg-primary/5 border-primary/30'
                          : 'border-border/30 hover:border-border/50'
                      }`}
                      data-testid={`lb-friend-${entry.rank}`}
                    >
                      {/* Rank */}
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                        entry.rank === 1 ? 'bg-amber-500/15 text-amber-400' :
                        entry.rank === 2 ? 'bg-zinc-400/15 text-zinc-300' :
                        entry.rank === 3 ? 'bg-orange-600/15 text-orange-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {entry.rank <= 3 ? ['', '1', '2', '3'][entry.rank] : `#${entry.rank}`}
                      </div>

                      {/* Avatar */}
                      <Avatar className="h-8 w-8 border border-border/50">
                        <AvatarImage src={entry.picture} alt={entry.nickname} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {(entry.nickname || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${entry.is_me ? 'text-primary' : 'text-foreground'}`}>
                          {entry.nickname || 'User'}{entry.is_me ? ' (You)' : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Level {entry.level}</p>
                      </div>

                      {/* Points */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${entry.is_me ? 'text-primary' : 'text-foreground'}`}>
                          {entry.points}
                        </p>
                        <p className="text-[10px] text-muted-foreground">pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <Trophy className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Add friends to see your ranking</p>
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
        </div>
      </main>

      <Footer />

      {/* Achievements Modal */}
      <AchievementsModal
        isOpen={showAchievementsModal}
        onClose={() => {
          setShowAchievementsModal(false);
          setHighlightAchievementId(null);
        }}
        achievements={achievementsAll}
        completedCount={achievementsCompleted}
        totalCount={achievementsTotal}
        highlightId={highlightAchievementId}
      />
    </div>
  );
};

export default ProfilePage;
