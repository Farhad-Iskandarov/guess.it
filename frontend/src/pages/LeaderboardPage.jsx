import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Crown, TrendingUp, Award, Calendar, Globe, Loader2, ChevronUp, Star } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/* ============ Skeleton ============ */
const RowSkeleton = () => (
  <div className="flex items-center gap-4 px-5 sm:px-8 py-4">
    <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
    <div className="w-10 h-10 rounded-full bg-secondary animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-32 bg-secondary rounded animate-pulse" />
      <div className="h-2.5 w-20 bg-secondary rounded animate-pulse" />
    </div>
    <div className="h-5 w-16 bg-secondary rounded animate-pulse" />
  </div>
);

const PodiumSkeleton = () => (
  <div className="py-12 sm:py-16">
    <div className="flex items-end justify-center gap-4 sm:gap-8">
      {[2, 1, 3].map((r) => (
        <div key={r} className={`flex flex-col items-center ${r === 1 ? 'order-2' : r === 2 ? 'order-1' : 'order-3'}`}>
          <div className={`${r === 1 ? 'w-[88px] h-[88px] sm:w-[110px] sm:h-[110px]' : 'w-[68px] h-[68px] sm:w-[84px] sm:h-[84px]'} rounded-full bg-secondary/50 animate-pulse mb-3`} />
          <div className="h-3 w-20 bg-secondary/50 rounded animate-pulse mb-2" />
          <div className="h-5 w-16 bg-secondary/50 rounded-full animate-pulse mb-4" />
          <div className={`w-[120px] sm:w-[160px] rounded-t-2xl animate-pulse ${r === 1 ? 'h-[110px] sm:h-[140px] bg-amber-500/15' : r === 2 ? 'h-[80px] sm:h-[100px] bg-slate-400/15' : 'h-[60px] sm:h-[76px] bg-orange-500/15'}`} />
        </div>
      ))}
    </div>
  </div>
);

/* ============ Podium Card ============ */
const PodiumCard = ({ user, rank }) => {
  const isFirst = rank === 1;
  const pts = user.weekly_points ?? user.points ?? 0;

  const config = {
    1: {
      gradient: 'from-amber-400 via-yellow-500 to-amber-600',
      blockBg: 'bg-gradient-to-t from-amber-600/90 via-amber-500/80 to-yellow-400/70',
      ring: 'ring-amber-400/70 shadow-[0_0_24px_rgba(245,158,11,0.35)]',
      avatarSize: 'w-[88px] h-[88px] sm:w-[110px] sm:h-[110px]',
      blockWidth: 'w-[130px] sm:w-[170px]',
      blockHeight: 'h-[110px] sm:h-[140px]',
      textSize: 'text-sm sm:text-base',
      ptsSize: 'text-sm sm:text-lg',
      order: 'order-2',
      delay: '0.3s',
    },
    2: {
      gradient: 'from-slate-300 via-gray-400 to-slate-500',
      blockBg: 'bg-gradient-to-t from-slate-600/80 via-slate-500/70 to-slate-400/60',
      ring: 'ring-slate-400/50 shadow-[0_0_16px_rgba(148,163,184,0.2)]',
      avatarSize: 'w-[68px] h-[68px] sm:w-[84px] sm:h-[84px]',
      blockWidth: 'w-[115px] sm:w-[150px]',
      blockHeight: 'h-[80px] sm:h-[100px]',
      textSize: 'text-xs sm:text-sm',
      ptsSize: 'text-xs sm:text-base',
      order: 'order-1',
      delay: '0.1s',
    },
    3: {
      gradient: 'from-orange-400 via-amber-600 to-orange-700',
      blockBg: 'bg-gradient-to-t from-orange-700/80 via-orange-600/70 to-amber-500/60',
      ring: 'ring-orange-400/50 shadow-[0_0_16px_rgba(251,146,60,0.2)]',
      avatarSize: 'w-[68px] h-[68px] sm:w-[84px] sm:h-[84px]',
      blockWidth: 'w-[115px] sm:w-[150px]',
      blockHeight: 'h-[60px] sm:h-[76px]',
      textSize: 'text-xs sm:text-sm',
      ptsSize: 'text-xs sm:text-base',
      order: 'order-3',
      delay: '0.5s',
    },
  }[rank];

  return (
    <div
      className={`podium-entrance flex flex-col items-center ${config.order}`}
      style={{ animationDelay: config.delay }}
      data-testid={`podium-rank-${rank}`}
    >
      {/* User info above pedestal */}
      <div className="podium-card-hover flex flex-col items-center pb-4">
        {/* Crown / Medal icon */}
        <div className="mb-2">
          {isFirst ? (
            <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 drop-shadow-[0_2px_4px_rgba(245,158,11,0.5)]" />
          ) : (
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-md`}>
              <span className="text-white font-bold text-xs">{rank}</span>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className={`relative ${config.avatarSize} ${isFirst ? 'podium-winner-glow' : ''}`}>
          <Avatar className={`w-full h-full ring-[3px] ${config.ring}`}>
            <AvatarImage src={user.picture?.startsWith('/') ? `${API_URL}${user.picture}` : user.picture} />
            <AvatarFallback className={`bg-gradient-to-br ${config.gradient} text-white font-bold ${isFirst ? 'text-3xl' : 'text-xl'}`}>
              {(user.nickname || user.email || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Username */}
        <p className={`font-bold text-foreground truncate max-w-[100px] sm:max-w-[140px] mt-3 ${config.textSize}`}>
          {user.nickname || user.email}
        </p>

        {/* Points */}
        <div className={`flex items-center gap-1.5 mt-1.5 px-4 py-1 rounded-full bg-gradient-to-r ${config.gradient} text-white font-bold shadow-lg ${config.ptsSize}`}>
          <TrendingUp className="w-3.5 h-3.5" />
          {pts.toLocaleString()}
        </div>
      </div>

      {/* Pedestal block */}
      <div className={`${config.blockWidth} ${config.blockHeight} ${config.blockBg} rounded-t-2xl flex items-center justify-center backdrop-blur-sm border-t border-white/10`}>
        <span className="text-white/80 font-black text-2xl sm:text-3xl tracking-tight">
          #{rank}
        </span>
      </div>
    </div>
  );
};

/* ============ Ranking Row ============ */
const RankRow = ({ user, rank, isCurrentUser }) => {
  const accuracy = user.predictions_count > 0 ? Math.round((user.correct_predictions / user.predictions_count) * 100) : 0;
  const pts = user.weekly_points ?? user.points ?? 0;

  return (
    <div
      className={`group grid grid-cols-12 gap-2 sm:gap-4 items-center px-5 sm:px-8 py-3.5 sm:py-4 transition-all duration-200 ${
        isCurrentUser
          ? 'bg-primary/8 border-l-3 border-primary ring-1 ring-primary/10'
          : 'hover:bg-secondary/40'
      }`}
      data-testid={`leaderboard-row-${rank}`}
    >
      {/* Rank */}
      <div className="col-span-1 text-center">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm transition-colors ${
          rank <= 10 ? 'bg-primary/10 text-primary' : 'bg-secondary/60 text-muted-foreground'
        }`}>
          {rank}
        </span>
      </div>

      {/* Player */}
      <div className="col-span-5 sm:col-span-6 flex items-center gap-2.5 sm:gap-3 min-w-0">
        <Avatar className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 ring-1 ring-border/50">
          <AvatarImage src={user.picture?.startsWith('/') ? `${API_URL}${user.picture}` : user.picture} />
          <AvatarFallback className="bg-secondary text-foreground font-semibold text-xs sm:text-sm">
            {(user.nickname || user.email || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate text-sm leading-tight">
            {user.nickname || user.email}
            {isCurrentUser && <span className="ml-1.5 text-[10px] text-primary font-medium">(You)</span>}
          </p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            {user.predictions_count || 0} predictions
          </p>
        </div>
      </div>

      {/* Level */}
      <div className="col-span-2 text-center hidden sm:block">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/50 text-foreground/70 font-medium text-xs">
          <Star className="w-3 h-3 text-amber-500" />
          Lv.{user.level || 1}
        </span>
      </div>

      {/* Points */}
      <div className="col-span-3 sm:col-span-2 text-right">
        <span className="inline-flex items-center gap-1 font-bold text-foreground text-sm sm:text-base">
          {pts.toLocaleString()}
        </span>
      </div>

      {/* Accuracy */}
      <div className="col-span-3 sm:col-span-1 text-right">
        <span className={`inline-flex items-center gap-0.5 font-semibold text-xs sm:text-sm ${
          accuracy >= 70 ? 'text-emerald-500' : accuracy >= 50 ? 'text-amber-500' : 'text-muted-foreground'
        }`}>
          {accuracy > 0 && accuracy >= 50 && <ChevronUp className="w-3 h-3" />}
          {accuracy}%
        </span>
      </div>
    </div>
  );
};

/* ============ Main Page ============ */
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
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.06] via-transparent to-transparent" />
        <div className="relative container mx-auto px-4 py-10 sm:py-14 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 mb-4">
            <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-2" data-testid="leaderboard-title">
            Leaderboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            See who's dominating the prediction game
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 sm:py-10 max-w-[1000px]">
        {/* Tab Switcher */}
        <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8" data-testid="leaderboard-tabs">
          <button
            onClick={() => setActiveTab('weekly')}
            data-testid="tab-weekly"
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
              activeTab === 'weekly'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Weekly
          </button>
          <button
            onClick={() => setActiveTab('global')}
            data-testid="tab-global"
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
              activeTab === 'global'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
            }`}
          >
            <Globe className="w-4 h-4" />
            Global
          </button>
        </div>

        {/* Week Badge */}
        {activeTab === 'weekly' && weekLabel && (
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-secondary/40 text-xs sm:text-sm text-muted-foreground border border-border/50">
              <Calendar className="w-3.5 h-3.5" />
              {weekLabel}
            </span>
          </div>
        )}

        {/* Content Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/[0.04] dark:shadow-black/[0.2]" data-testid="leaderboard-card">
          {loading ? (
            <>
              <PodiumSkeleton />
              <div className="border-t border-border">
                {[...Array(5)].map((_, i) => <RowSkeleton key={i} />)}
              </div>
            </>
          ) : users.length === 0 ? (
            <div className="py-20 text-center" data-testid="leaderboard-empty">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/40 mb-4">
                <Trophy className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground font-medium text-base">
                {activeTab === 'weekly' ? 'No points earned this week yet.' : 'No users on the board yet.'}
              </p>
              <p className="text-muted-foreground/60 text-sm mt-1">Be the first to climb the ranks!</p>
            </div>
          ) : (
            <>
              {/* ==================== PODIUM SECTION ==================== */}
              {top3.length > 0 && (
                <div className="podium-section relative px-4 py-10 sm:py-14" data-testid="podium-section">
                  {/* Background decoration */}
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] via-transparent to-transparent" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(245,158,11,0.06)_0%,transparent_60%)]" />

                  {/* Podium stage */}
                  <div className="relative flex items-end justify-center gap-4 sm:gap-8 max-w-[560px] mx-auto">
                    {top3.length >= 2 && <PodiumCard user={top3[1]} rank={2} />}
                    {top3.length >= 1 && <PodiumCard user={top3[0]} rank={1} />}
                    {top3.length >= 3 && <PodiumCard user={top3[2]} rank={3} />}

                    {/* Fill empty podium slots with placeholders when < 3 users */}
                    {top3.length === 1 && (
                      <>
                        <div className="order-1 w-[115px] sm:w-[150px] flex flex-col items-center opacity-20">
                          <div className="w-[68px] h-[68px] sm:w-[84px] sm:h-[84px] rounded-full bg-secondary/40 mb-3" />
                          <div className="h-3 w-12 bg-secondary/40 rounded mb-2" />
                          <div className={`w-full h-[80px] sm:h-[100px] rounded-t-2xl bg-slate-400/20`} />
                        </div>
                        <div className="order-3 w-[115px] sm:w-[150px] flex flex-col items-center opacity-20">
                          <div className="w-[68px] h-[68px] sm:w-[84px] sm:h-[84px] rounded-full bg-secondary/40 mb-3" />
                          <div className="h-3 w-12 bg-secondary/40 rounded mb-2" />
                          <div className={`w-full h-[60px] sm:h-[76px] rounded-t-2xl bg-orange-400/20`} />
                        </div>
                      </>
                    )}
                    {top3.length === 2 && (
                      <div className="order-3 w-[115px] sm:w-[150px] flex flex-col items-center opacity-20">
                        <div className="w-[68px] h-[68px] sm:w-[84px] sm:h-[84px] rounded-full bg-secondary/40 mb-3" />
                        <div className="h-3 w-12 bg-secondary/40 rounded mb-2" />
                        <div className={`w-full h-[60px] sm:h-[76px] rounded-t-2xl bg-orange-400/20`} />
                      </div>
                    )}
                  </div>

                  {/* Base line under podium */}
                  <div className="max-w-[560px] mx-auto mt-0">
                    <div className="h-[2px] bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                </div>
              )}

              {/* ==================== TABLE SECTION ==================== */}
              {/* Separator */}
              <div className="relative">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>

              {/* Table Header */}
              <div className="bg-secondary/20 px-5 sm:px-8 py-3.5 border-t border-b border-border/60" data-testid="table-header">
                <div className="grid grid-cols-12 gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-5 sm:col-span-6">Player</div>
                  <div className="col-span-2 text-center hidden sm:block">Level</div>
                  <div className="col-span-3 sm:col-span-2 text-right">Points</div>
                  <div className="col-span-3 sm:col-span-1 text-right">Acc</div>
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/30" data-testid="ranking-list">
                {rest.map((user, idx) => (
                  <RankRow
                    key={user.user_id}
                    user={user}
                    rank={idx + 4}
                    isCurrentUser={currentUser?.user_id === user.user_id}
                  />
                ))}
                {rest.length === 0 && top3.length > 0 && (
                  <div className="py-10 text-center">
                    <p className="text-muted-foreground/60 text-sm">
                      Only {top3.length} player{top3.length > 1 ? 's' : ''} on the board so far.
                    </p>
                    <p className="text-muted-foreground/40 text-xs mt-1">
                      Make predictions to climb the ranks!
                    </p>
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
