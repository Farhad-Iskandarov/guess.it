import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Trophy, Crown, TrendingUp, Award, Calendar, Globe, Loader2, ChevronUp, Star, Clock, Medal, History, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/* ============ Countdown Hook ============ */
const useCountdown = (endSeconds) => {
  const [remaining, setRemaining] = useState(endSeconds);
  const ref = useRef(endSeconds);

  useEffect(() => {
    ref.current = endSeconds;
    setRemaining(endSeconds);
  }, [endSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return { days, hours, minutes, seconds, total: remaining };
};

/* ============ Countdown Display ============ */
const CountdownUnit = ({ value, label }) => (
  <div className="flex flex-col items-center">
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-center">
      <span className="text-lg sm:text-xl font-bold text-foreground tabular-nums">{String(value).padStart(2, '0')}</span>
    </div>
    <span className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">{label}</span>
  </div>
);

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
const PodiumCard = ({ user, rank, isWeekly }) => {
  const isFirst = rank === 1;
  const pts = isWeekly ? (user.weekly_points ?? 0) : (user.points ?? 0);

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
    <div className={`podium-entrance flex flex-col items-center ${config.order}`} style={{ animationDelay: config.delay }} data-testid={`podium-rank-${rank}`}>
      <div className="podium-card-hover flex flex-col items-center pb-4">
        <div className="mb-2">
          {isFirst ? (
            <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 drop-shadow-[0_2px_4px_rgba(245,158,11,0.5)]" />
          ) : (
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-md`}>
              <span className="text-white font-bold text-xs">{rank}</span>
            </div>
          )}
        </div>
        <div className={`relative ${config.avatarSize} ${isFirst ? 'podium-winner-glow' : ''}`}>
          <Avatar className={`w-full h-full ring-[3px] ${config.ring}`}>
            <AvatarImage src={user.picture?.startsWith('/') ? `${API_URL}${user.picture}` : user.picture} />
            <AvatarFallback className={`bg-gradient-to-br ${config.gradient} text-white font-bold ${isFirst ? 'text-3xl' : 'text-xl'}`}>
              {(user.nickname || user.email || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <p className={`font-bold text-foreground truncate max-w-[100px] sm:max-w-[140px] mt-3 ${config.textSize}`}>
          {user.nickname || user.email}
        </p>
        <div className={`flex items-center gap-1.5 mt-1.5 px-4 py-1 rounded-full bg-gradient-to-r ${config.gradient} text-white font-bold shadow-lg ${config.ptsSize}`}>
          <TrendingUp className="w-3.5 h-3.5" />
          {pts.toLocaleString()}
        </div>
      </div>
      <div className={`${config.blockWidth} ${config.blockHeight} ${config.blockBg} rounded-t-2xl flex items-center justify-center backdrop-blur-sm border-t border-white/10`}>
        <span className="text-white/80 font-black text-2xl sm:text-3xl tracking-tight">#{rank}</span>
      </div>
    </div>
  );
};

/* ============ Ranking Row ============ */
const RankRow = ({ user, rank, isCurrentUser, isWeekly }) => {
  const pts = isWeekly ? (user.weekly_points ?? 0) : (user.points ?? 0);
  const accuracy = user.predictions_count > 0 ? Math.round((user.correct_predictions / user.predictions_count) * 100) : 0;

  return (
    <div
      className={`group grid grid-cols-12 gap-2 sm:gap-4 items-center px-5 sm:px-8 py-3.5 sm:py-4 transition-all duration-200 ${
        isCurrentUser ? 'bg-primary/8 border-l-3 border-primary ring-1 ring-primary/10' : 'hover:bg-secondary/40'
      }`}
      data-testid={`leaderboard-row-${rank}`}
    >
      <div className="col-span-1 text-center">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm transition-colors ${
          rank <= 10 ? 'bg-primary/10 text-primary' : 'bg-secondary/60 text-muted-foreground'
        }`}>{rank}</span>
      </div>
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
      <div className="col-span-2 text-center hidden sm:block">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/50 text-foreground/70 font-medium text-xs">
          <Star className="w-3 h-3 text-amber-500" />
          Lv.{user.level || 1}
        </span>
      </div>
      <div className="col-span-3 sm:col-span-2 text-right">
        <span className="inline-flex items-center gap-1 font-bold text-foreground text-sm sm:text-base">{pts.toLocaleString()}</span>
      </div>
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

/* ============ Season Summary Modal ============ */
const SeasonSummary = ({ season, onClose }) => {
  if (!season) return null;
  const winner = season.winner;
  return (
    <div className="mb-6 bg-gradient-to-br from-amber-500/[0.06] to-transparent border border-amber-500/20 rounded-2xl p-6 sm:p-8" data-testid="season-summary">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <Medal className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-base">Last Week's Winner</h3>
          <p className="text-xs text-muted-foreground">{season.season_id} completed</p>
        </div>
        <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground text-sm" data-testid="dismiss-summary">Dismiss</button>
      </div>
      {winner && (
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-14 h-14 ring-2 ring-amber-400/60">
              <AvatarImage src={winner.picture?.startsWith('/') ? `${API_URL}${winner.picture}` : winner.picture} />
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold text-xl">
                {(winner.nickname || '?')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Crown className="absolute -top-2.5 -right-2 w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-foreground text-lg">{winner.nickname}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              <span className="text-amber-500 font-bold">{winner.points?.toLocaleString()} pts</span>
              <span>{season.total_participants} players</span>
              <span>{season.total_predictions} predictions</span>
            </div>
          </div>
        </div>
      )}
      {season.top_10 && season.top_10.length > 1 && (
        <div className="mt-4 pt-4 border-t border-border/40">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Top 5</p>
          <div className="flex flex-wrap gap-3">
            {season.top_10.slice(0, 5).map((u, i) => (
              <div key={u.user_id} className="flex items-center gap-1.5 text-sm">
                <span className={`font-bold ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  #{u.rank}
                </span>
                <span className="text-foreground/80">{u.nickname}</span>
                <span className="text-muted-foreground/60 text-xs">{u.points}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============ Main Page ============ */
export const LeaderboardPage = () => {
  const [activeTab, setActiveTab] = useState('weekly');
  const [globalUsers, setGlobalUsers] = useState([]);
  const [weeklyData, setWeeklyData] = useState(null);
  const [weeklyStatus, setWeeklyStatus] = useState(null);
  const [previousSeason, setPreviousSeason] = useState(null);
  const [showSummary, setShowSummary] = useState(true);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  const fetchWeeklyStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/weekly/status`, { credentials: 'include' });
      if (res.ok) setWeeklyStatus(await res.json());
    } catch (e) { console.error('Weekly status error:', e); }
  }, []);

  const fetchWeeklyLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/weekly/leaderboard?limit=50`);
      if (res.ok) setWeeklyData(await res.json());
    } catch (e) { console.error('Weekly leaderboard error:', e); }
  }, []);

  const fetchGlobalLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/football/leaderboard?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setGlobalUsers(data.users || []);
      }
    } catch (e) { console.error('Global leaderboard error:', e); }
  }, []);

  const fetchPreviousSeason = useCallback(async () => {
    try {
      const histRes = await fetch(`${API_URL}/api/weekly/history?limit=1`);
      if (histRes.ok) {
        const hist = await histRes.json();
        if (hist.seasons?.length > 0) {
          const sid = hist.seasons[0].season_id;
          const sumRes = await fetch(`${API_URL}/api/weekly/summary/${sid}`, { credentials: 'include' });
          if (sumRes.ok) setPreviousSeason(await sumRes.json());
        }
      }
    } catch (e) { console.error('Previous season error:', e); }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchWeeklyStatus(),
        activeTab === 'weekly' ? fetchWeeklyLeaderboard() : fetchGlobalLeaderboard(),
        fetchPreviousSeason(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [activeTab, fetchWeeklyStatus, fetchWeeklyLeaderboard, fetchGlobalLeaderboard, fetchPreviousSeason]);

  // Periodic refresh (30s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'weekly') fetchWeeklyLeaderboard();
      else fetchGlobalLeaderboard();
      fetchWeeklyStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchWeeklyLeaderboard, fetchGlobalLeaderboard, fetchWeeklyStatus]);

  const weeklyUsers = weeklyData?.users || [];
  const users = activeTab === 'weekly' ? weeklyUsers : globalUsers;
  const top3 = users.slice(0, 3);
  const rest = users.slice(3);
  const isWeekly = activeTab === 'weekly';

  const countdown = useCountdown(weeklyStatus?.ends_in_seconds || 0);

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

        {/* Weekly Countdown + Status */}
        {activeTab === 'weekly' && weeklyStatus && countdown.total > 0 && (
          <div className="mb-6 bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/[0.04] dark:shadow-black/[0.15]" data-testid="weekly-countdown">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 sm:px-8 py-5 sm:py-6">
              {/* Left: Season info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm sm:text-base">
                    Season {weeklyStatus.current_season_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {weeklyStatus.total_participants} players &middot; {weeklyStatus.total_predictions} predictions
                  </p>
                </div>
              </div>

              {/* Right: Countdown */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wider mr-1 hidden sm:block">Ends in</span>
                <CountdownUnit value={countdown.days} label="Days" />
                <span className="text-lg font-light text-muted-foreground/50 mt-[-12px]">:</span>
                <CountdownUnit value={countdown.hours} label="Hrs" />
                <span className="text-lg font-light text-muted-foreground/50 mt-[-12px]">:</span>
                <CountdownUnit value={countdown.minutes} label="Min" />
                <span className="text-lg font-light text-muted-foreground/50 mt-[-12px]">:</span>
                <CountdownUnit value={countdown.seconds} label="Sec" />
              </div>
            </div>

            {/* User's rank strip */}
            {weeklyStatus.user_current_rank && (
              <div className="border-t border-border/60 bg-primary/[0.04] px-6 sm:px-8 py-3 flex items-center justify-between" data-testid="user-rank-strip">
                <span className="text-sm text-foreground/70">Your rank</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-primary text-lg">#{weeklyStatus.user_current_rank}</span>
                  <span className="text-sm text-muted-foreground">{weeklyStatus.user_weekly_points?.toLocaleString()} pts</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Previous Season Winner Highlight */}
        {activeTab === 'weekly' && previousSeason && showSummary && (
          <SeasonSummary season={previousSeason} onClose={() => setShowSummary(false)} />
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
                {isWeekly ? 'No points earned this week yet.' : 'No users on the board yet.'}
              </p>
              <p className="text-muted-foreground/60 text-sm mt-1">Be the first to climb the ranks!</p>
            </div>
          ) : (
            <>
              {/* Podium */}
              {top3.length > 0 && (
                <div className="podium-section relative px-4 py-10 sm:py-14" data-testid="podium-section">
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] via-transparent to-transparent" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(245,158,11,0.06)_0%,transparent_60%)]" />
                  <div className="relative flex items-end justify-center gap-4 sm:gap-8 max-w-[560px] mx-auto">
                    {top3.length >= 2 && <PodiumCard user={top3[1]} rank={2} isWeekly={isWeekly} />}
                    {top3.length >= 1 && <PodiumCard user={top3[0]} rank={1} isWeekly={isWeekly} />}
                    {top3.length >= 3 && <PodiumCard user={top3[2]} rank={3} isWeekly={isWeekly} />}
                    {top3.length === 1 && (
                      <>
                        <div className="order-1 w-[115px] sm:w-[150px] flex flex-col items-center opacity-20">
                          <div className="w-[68px] h-[68px] sm:w-[84px] sm:h-[84px] rounded-full bg-secondary/40 mb-3" />
                          <div className="h-3 w-12 bg-secondary/40 rounded mb-2" />
                          <div className="w-full h-[80px] sm:h-[100px] rounded-t-2xl bg-slate-400/20" />
                        </div>
                        <div className="order-3 w-[115px] sm:w-[150px] flex flex-col items-center opacity-20">
                          <div className="w-[68px] h-[68px] sm:w-[84px] sm:h-[84px] rounded-full bg-secondary/40 mb-3" />
                          <div className="h-3 w-12 bg-secondary/40 rounded mb-2" />
                          <div className="w-full h-[60px] sm:h-[76px] rounded-t-2xl bg-orange-400/20" />
                        </div>
                      </>
                    )}
                    {top3.length === 2 && (
                      <div className="order-3 w-[115px] sm:w-[150px] flex flex-col items-center opacity-20">
                        <div className="w-[68px] h-[68px] sm:w-[84px] sm:h-[84px] rounded-full bg-secondary/40 mb-3" />
                        <div className="h-3 w-12 bg-secondary/40 rounded mb-2" />
                        <div className="w-full h-[60px] sm:h-[76px] rounded-t-2xl bg-orange-400/20" />
                      </div>
                    )}
                  </div>
                  <div className="max-w-[560px] mx-auto mt-0">
                    <div className="h-[2px] bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="relative">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>
              <div className="bg-secondary/20 px-5 sm:px-8 py-3.5 border-t border-b border-border/60" data-testid="table-header">
                <div className="grid grid-cols-12 gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-5 sm:col-span-6">Player</div>
                  <div className="col-span-2 text-center hidden sm:block">Level</div>
                  <div className="col-span-3 sm:col-span-2 text-right">Points</div>
                  <div className="col-span-3 sm:col-span-1 text-right">Acc</div>
                </div>
              </div>
              <div className="divide-y divide-border/30" data-testid="ranking-list">
                {rest.map((user, idx) => (
                  <RankRow key={user.user_id} user={user} rank={idx + 4} isCurrentUser={currentUser?.user_id === user.user_id} isWeekly={isWeekly} />
                ))}
                {rest.length === 0 && top3.length > 0 && (
                  <div className="py-10 text-center">
                    <p className="text-muted-foreground/60 text-sm">
                      Only {top3.length} player{top3.length > 1 ? 's' : ''} on the board so far.
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
