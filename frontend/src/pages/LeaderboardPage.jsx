import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Medal, Crown, TrendingUp, Award, Calendar, Globe, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============ Skeleton ============
const RowSkeleton = () => (
  <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
    <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
    <div className="w-9 h-9 rounded-full bg-secondary animate-pulse" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3.5 w-28 bg-secondary rounded animate-pulse" />
      <div className="h-2.5 w-16 bg-secondary rounded animate-pulse" />
    </div>
    <div className="h-5 w-14 bg-secondary rounded animate-pulse" />
  </div>
);

const PodiumSkeleton = () => (
  <div className="px-4 py-8 sm:py-12">
    <div className="flex items-end justify-center gap-3 sm:gap-5 max-w-[520px] mx-auto">
      {[2, 1, 3].map((r) => (
        <div key={r} className={`flex flex-col items-center shrink-0 ${r === 1 ? 'order-2 w-[150px] sm:w-[180px]' : r === 2 ? 'order-1 w-[120px] sm:w-[150px]' : 'order-3 w-[120px] sm:w-[150px]'}`}>
          <div className="flex flex-col items-center gap-2 pb-3">
            <div className={`${r === 1 ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-14 h-14 sm:w-18 sm:h-18'} rounded-full bg-secondary/60 animate-pulse`} />
            <div className="h-3 w-20 bg-secondary/60 rounded animate-pulse" />
            <div className="h-5 w-14 bg-secondary/60 rounded-full animate-pulse" />
          </div>
          <div className={`w-full rounded-t-xl ${r === 1 ? 'h-[96px] sm:h-[120px] bg-amber-600/30' : r === 2 ? 'h-[68px] sm:h-[84px] bg-slate-500/30' : 'h-[48px] sm:h-[60px] bg-orange-600/30'} flex items-center justify-center animate-pulse`}>
            <div className="h-6 w-6 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ============ Podium Card (Redesigned) ============
const PodiumCard = ({ user, rank }) => {
  const isFirst = rank === 1;
  const pts = user.weekly_points ?? user.points ?? 0;

  const config = {
    1: {
      gradient: 'from-yellow-500 to-amber-600',
      blockGradient: 'from-yellow-500/90 to-amber-700/90',
      ring: 'ring-yellow-400/60',
      avatarSize: 'w-20 h-20 sm:w-24 sm:h-24',
      textSize: 'text-sm sm:text-base',
      ptsSize: 'text-sm sm:text-lg',
      icon: <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />,
      delay: '400ms',
      slotWidth: 'w-[150px] sm:w-[180px] order-2',
      blockHeight: 'h-[96px] sm:h-[120px]',
    },
    2: {
      gradient: 'from-slate-300 to-slate-500',
      blockGradient: 'from-slate-400/80 to-slate-600/80',
      ring: 'ring-slate-300/50',
      avatarSize: 'w-14 h-14 sm:w-18 sm:h-18',
      textSize: 'text-xs sm:text-sm',
      ptsSize: 'text-xs sm:text-base',
      icon: <Medal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />,
      delay: '0ms',
      slotWidth: 'w-[120px] sm:w-[150px] order-1',
      blockHeight: 'h-[68px] sm:h-[84px]',
    },
    3: {
      gradient: 'from-orange-400 to-orange-700',
      blockGradient: 'from-orange-500/80 to-orange-800/80',
      ring: 'ring-orange-400/50',
      avatarSize: 'w-14 h-14 sm:w-18 sm:h-18',
      textSize: 'text-xs sm:text-sm',
      ptsSize: 'text-xs sm:text-base',
      icon: <Medal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />,
      delay: '200ms',
      slotWidth: 'w-[120px] sm:w-[150px] order-3',
      blockHeight: 'h-[48px] sm:h-[60px]',
    },
  }[rank];

  return (
    <div
      className={`flex flex-col items-center shrink-0 podium-entrance ${config.slotWidth}`}
      style={{ animationDelay: config.delay }}
      data-testid={`podium-rank-${rank}`}
    >
      {/* User info above pedestal */}
      <div className="podium-card-hover flex flex-col items-center gap-1.5 sm:gap-2 pb-3">
        {/* Rank badge */}
        <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
          {config.icon}
        </div>

        {/* Avatar */}
        <div className={`relative ${config.avatarSize} ${isFirst ? 'podium-winner-glow' : ''}`}>
          <Avatar className={`w-full h-full ring-[3px] ${config.ring} shadow-xl`}>
            <AvatarImage src={user.picture?.startsWith('/') ? `${API_URL}${user.picture}` : user.picture} />
            <AvatarFallback className={`bg-gradient-to-br ${config.gradient} text-white font-bold ${isFirst ? 'text-2xl' : 'text-lg'}`}>
              {(user.nickname || user.email || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Username */}
        <p className={`font-bold text-foreground truncate max-w-[90px] sm:max-w-[130px] ${config.textSize}`}>
          {user.nickname || user.email}
        </p>

        {/* Points pill */}
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r ${config.gradient} text-white font-bold shadow-md ${config.ptsSize}`}>
          <TrendingUp className="w-3.5 h-3.5" />
          {pts}
        </div>
      </div>

      {/* Pedestal block */}
      <div className={`w-full rounded-t-xl bg-gradient-to-t ${config.blockGradient} backdrop-blur-sm flex items-center justify-center ${config.blockHeight}`}>
        <span className="text-white/90 font-extrabold text-xl sm:text-2xl">{rank}</span>
      </div>
    </div>
  );
};

// ============ Ranking Row ============
const RankRow = ({ user, rank, isCurrentUser }) => {
  const accuracy = user.predictions_count > 0 ? Math.round((user.correct_predictions / user.predictions_count) * 100) : 0;
  const pts = user.weekly_points ?? user.points ?? 0;

  return (
    <div
      className={`grid grid-cols-12 gap-2 sm:gap-4 items-center px-4 sm:px-6 py-3 hover:bg-secondary/20 transition-colors ${
        isCurrentUser ? 'bg-primary/10 border-l-2 border-primary' : ''
      }`}
      data-testid={`leaderboard-row-${rank}`}
    >
      {/* Rank */}
      <div className="col-span-1 text-center">
        <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full font-bold text-xs sm:text-sm bg-secondary text-foreground">
          {rank}
        </span>
      </div>
      {/* Player */}
      <div className="col-span-5 sm:col-span-6 flex items-center gap-2 sm:gap-3 min-w-0">
        <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
          <AvatarImage src={user.picture?.startsWith('/') ? `${API_URL}${user.picture}` : user.picture} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs sm:text-sm">
            {(user.nickname || user.email || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate text-sm">{user.nickname || user.email}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{user.predictions_count || 0} predictions</p>
        </div>
      </div>
      {/* Level */}
      <div className="col-span-2 text-center hidden sm:block">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-xs">
          <Award className="w-3 h-3" />{user.level || 1}
        </span>
      </div>
      {/* Points */}
      <div className="col-span-3 sm:col-span-2 text-right">
        <span className="inline-flex items-center gap-1 font-bold text-foreground text-sm sm:text-base">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />{pts}
        </span>
      </div>
      {/* Accuracy */}
      <div className="col-span-3 sm:col-span-1 text-right">
        <span className={`font-semibold text-xs sm:text-sm ${accuracy >= 70 ? 'text-emerald-500' : accuracy >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
          {accuracy}%
        </span>
      </div>
    </div>
  );
};

// ============ Main Page ============
export const LeaderboardPage = () => {
  const [activeTab, setActiveTab] = useState('weekly');
  const [weeklyUsers, setWeeklyUsers] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);
  const [weekInfo, setWeekInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  const fetchLeaderboard = useCallback(async (tab) => {
    setLoading(true);
    try {
      const endpoint = tab === 'weekly' ? '/api/football/leaderboard/weekly' : '/api/football/leaderboard?limit=50';
      const res = await fetch(`${API_URL}${endpoint}`);
      if (res.ok) {
        const data = await res.json();
        if (tab === 'weekly') {
          setWeeklyUsers(data.users || []);
          setWeekInfo({ start: data.week_start, end: data.week_end });
        } else {
          setGlobalUsers(data.users || []);
        }
      }
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(activeTab);
  }, [activeTab, fetchLeaderboard]);

  const users = activeTab === 'weekly' ? weeklyUsers : globalUsers;
  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  const weekLabel = useMemo(() => {
    if (!weekInfo?.start) return '';
    const s = new Date(weekInfo.start);
    const e = new Date(weekInfo.end);
    return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }, [weekInfo]);

  return (
    <div className="min-h-screen bg-background" data-testid="leaderboard-page">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
        <div className="container mx-auto px-4 py-10 sm:py-14 text-center">
          <Trophy className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">
            Leaderboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            See who's dominating the prediction game
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-10">
        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 mb-6" data-testid="leaderboard-tabs">
          <button
            onClick={() => setActiveTab('weekly')}
            data-testid="tab-weekly"
            className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full font-semibold text-sm transition-all ${
              activeTab === 'weekly'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Weekly
          </button>
          <button
            onClick={() => setActiveTab('global')}
            data-testid="tab-global"
            className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full font-semibold text-sm transition-all ${
              activeTab === 'global'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Globe className="w-4 h-4" />
            Global
          </button>
        </div>

        {/* Week info badge */}
        {activeTab === 'weekly' && weekLabel && (
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/50 text-xs sm:text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {weekLabel}
            </span>
          </div>
        )}

        {/* Content Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <>
              <PodiumSkeleton />
              <div className="divide-y divide-border border-t border-border">
                {[...Array(5)].map((_, i) => <RowSkeleton key={i} />)}
              </div>
            </>
          ) : users.length === 0 ? (
            <div className="py-16 text-center" data-testid="leaderboard-empty">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">
                {activeTab === 'weekly' ? 'No points earned this week yet. Be the first!' : 'No users yet. Be the first!'}
              </p>
            </div>
          ) : (
            <>
              {/* Top 3 Podium */}
              {top3.length > 0 && (
                <div className="podium-wrapper px-4 py-8 sm:py-12 bg-gradient-to-b from-primary/5 to-transparent" data-testid="podium-section">
                  <div className="podium-stage">
                    {top3.length >= 2 && <PodiumCard user={top3[1]} rank={2} />}
                    {top3.length >= 1 && <PodiumCard user={top3[0]} rank={1} />}
                    {top3.length >= 3 && <PodiumCard user={top3[2]} rank={3} />}
                  </div>
                </div>
              )}

              {/* Table Header */}
              <div className="bg-secondary/30 px-4 sm:px-6 py-3 border-t border-b border-border">
                <div className="grid grid-cols-12 gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-1 text-center">Rank</div>
                  <div className="col-span-5 sm:col-span-6">Player</div>
                  <div className="col-span-2 text-center hidden sm:block">Level</div>
                  <div className="col-span-3 sm:col-span-2 text-right">Points</div>
                  <div className="col-span-3 sm:col-span-1 text-right">Acc</div>
                </div>
              </div>

              {/* Ranking Rows */}
              <div className="divide-y divide-border/50" data-testid="ranking-list">
                {rest.map((user, idx) => (
                  <RankRow
                    key={user.user_id}
                    user={user}
                    rank={idx + 4}
                    isCurrentUser={currentUser?.user_id === user.user_id}
                  />
                ))}
                {rest.length === 0 && top3.length > 0 && (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Only {top3.length} player{top3.length > 1 ? 's' : ''} on the board so far.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
