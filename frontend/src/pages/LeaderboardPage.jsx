import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Crown, Target, Zap, Flame, ChevronRight, ChevronLeft, Info,
  Globe, Calendar, BarChart3, Clock, ArrowUp, ArrowDown, Loader2,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/* ================= Countdown hook ================= */
const useCountdown = (endSeconds) => {
  const [remaining, setRemaining] = useState(endSeconds);
  useEffect(() => { setRemaining(endSeconds); }, [endSeconds]);
  useEffect(() => {
    const t = setInterval(() => setRemaining((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  return { days, hours, minutes, total: remaining };
};

/* ================= Helpers ================= */
const getAccuracy = (u) =>
  u?.predictions_count > 0
    ? Math.round(((u.correct_predictions || 0) / u.predictions_count) * 100)
    : 0;

const resolveAvatar = (p) => (p?.startsWith('/') ? `${API_URL}${p}` : p);

/* ================= Rank Badge (hex-ish pill with number) ================= */
const RankBadge = ({ rank }) => {
  const styles = {
    1: 'bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 border-amber-300',
    2: 'bg-gradient-to-b from-slate-300 to-slate-500 text-slate-900 border-slate-200',
    3: 'bg-gradient-to-b from-orange-400 to-orange-700 text-orange-950 border-orange-300',
  }[rank];
  return (
    <div
      className={`inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border-[1.5px] font-black text-sm sm:text-base shadow-md ${styles}`}
      style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
    >
      {rank}
    </div>
  );
};

/* ================= Podium Card ================= */
const PodiumCard = ({ user, rank, isWeekly }) => {
  const isFirst = rank === 1;
  const pts = isWeekly ? user.weekly_points ?? 0 : user.points ?? 0;
  const accuracy = getAccuracy(user);
  const streak = user.streak ?? 0;

  const order = isFirst ? 'order-2' : rank === 2 ? 'order-1' : 'order-3';

  const ring = {
    1: 'ring-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.45)]',
    2: 'ring-slate-400/70',
    3: 'ring-orange-500/70',
  }[rank];

  const bgGlow = {
    1: 'from-amber-500/[0.16] via-amber-500/[0.05] to-transparent',
    2: 'from-slate-500/[0.07] to-transparent',
    3: 'from-orange-500/[0.07] to-transparent',
  }[rank];

  const avatarSize = isFirst ? 'w-[92px] h-[92px] sm:w-[120px] sm:h-[120px]' : 'w-[68px] h-[68px] sm:w-[92px] sm:h-[92px]';
  const cardPadTop = isFirst ? 'pt-7 sm:pt-9' : 'pt-5 sm:pt-7';

  return (
    <div className={`podium-entrance flex flex-col items-center ${order} relative`} data-testid={`podium-rank-${rank}`}>
      {/* Soft radial glow */}
      <div className={`absolute -inset-4 bg-gradient-to-b ${bgGlow} rounded-3xl pointer-events-none`} />

      <div className={`relative z-10 w-[110px] sm:w-[150px] rounded-2xl bg-card/80 border border-border/60 ${cardPadTop} pb-3 px-2.5 sm:px-3 flex flex-col items-center`}>
        {/* Rank badge top-left */}
        <div className="absolute -top-3 left-2 sm:left-3 z-20">
          <RankBadge rank={rank} />
        </div>
        {/* Crown on 1st */}
        {isFirst && (
          <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 w-7 h-7 text-amber-400 drop-shadow-[0_2px_6px_rgba(245,158,11,0.5)]" />
        )}

        {/* Avatar */}
        <div className={`relative ${avatarSize}`}>
          <Avatar className={`w-full h-full ring-[3px] ${ring}`}>
            <AvatarImage src={resolveAvatar(user.picture)} />
            <AvatarFallback className={`bg-secondary text-foreground font-bold ${isFirst ? 'text-2xl' : 'text-lg'}`}>
              {(user.nickname || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name */}
        <p className={`mt-3 font-bold text-foreground text-center truncate w-full ${isFirst ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
          {user.nickname || '—'}
        </p>

        {/* Points */}
        <div className={`mt-1 flex items-center gap-1 font-extrabold ${isFirst ? 'text-base sm:text-xl text-amber-400' : 'text-sm sm:text-base text-foreground'}`}>
          <Zap className={`${isFirst ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-3.5 h-3.5'} ${isFirst ? 'fill-amber-400 text-amber-400' : 'fill-primary text-primary'}`} />
          <span className="tabular-nums">{pts.toLocaleString()}</span>
        </div>

        {/* Stats row */}
        <div className="mt-2 pt-2 border-t border-border/40 w-full flex items-center justify-around text-[11px]">
          <span className="inline-flex items-center gap-0.5 text-muted-foreground">
            <Target className="w-3 h-3" />
            <span className="tabular-nums">{accuracy}%</span>
          </span>
          <span className="w-px h-3 bg-border/50" />
          <span className="inline-flex items-center gap-0.5 text-orange-400">
            <Flame className="w-3 h-3 fill-orange-400" />
            <span className="tabular-nums">{streak}</span>
          </span>
        </div>
      </div>

      {/* Gold platform under 1st place */}
      {isFirst && (
        <div className="relative z-0 -mt-1 w-[120px] sm:w-[160px] h-2.5 sm:h-3 rounded-b-2xl bg-gradient-to-r from-amber-500/70 via-amber-400 to-amber-500/70 shadow-[0_8px_24px_rgba(245,158,11,0.35)]" />
      )}
    </div>
  );
};

/* ================= Rank Row (4+) ================= */
const RankRow = ({ user, rank, isCurrentUser, isWeekly, onClick }) => {
  const pts = isWeekly ? user.weekly_points ?? 0 : user.points ?? 0;
  const accuracy = getAccuracy(user);
  const streak = user.streak ?? 0;
  const todayDelta = user.today_points ?? null;
  const rankChange = user.rank_change ?? 0; // +N (up) / -N (down)

  // Slightly larger text on the signed-in user's own row to make it easy to spot
  const nameSize = isCurrentUser ? 'text-sm sm:text-lg' : 'text-xs sm:text-sm';
  const rankSize = isCurrentUser ? 'text-sm sm:text-lg' : 'text-sm sm:text-base';
  const accSize = isCurrentUser ? 'text-[11px] sm:text-sm' : 'text-[10px] sm:text-[11px]';
  const ptsSize = isCurrentUser ? 'text-sm sm:text-lg' : 'text-xs sm:text-sm';
  const streakSize = isCurrentUser ? 'text-xs sm:text-base' : 'text-xs sm:text-sm';
  const avatarSize = isCurrentUser ? 'w-9 h-9 sm:w-12 sm:h-12' : 'w-8 h-8 sm:w-10 sm:h-10';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left grid grid-cols-[38px_1fr_52px_68px_52px_10px] sm:grid-cols-[60px_1fr_72px_100px_72px_16px] gap-1.5 sm:gap-3 items-center px-2 sm:px-5 ${
        isCurrentUser ? 'py-3 sm:py-4' : 'py-2.5 sm:py-3.5'
      } rounded-xl transition-colors ${
        isCurrentUser
          ? 'bg-primary/[0.08] border border-primary/50 shadow-[0_0_0_2px_rgba(34,197,94,0.15),_inset_0_0_24px_rgba(34,197,94,0.06)]'
          : 'hover:bg-secondary/40 border border-transparent'
      }`}
      data-testid={`leaderboard-row-${rank}`}
    >
      {/* Rank + change */}
      <div className="flex flex-col items-center gap-0.5">
        {isCurrentUser ? (
          <span
            className={`inline-flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-primary/80 font-bold text-foreground tabular-nums ${rankSize}`}
          >
            {rank}
          </span>
        ) : (
          <span className={`font-bold text-foreground tabular-nums ${rankSize}`}>{rank}</span>
        )}
        {rankChange !== 0 && (
          <span className={`inline-flex items-center text-[9px] sm:text-[10px] tabular-nums font-semibold ${rankChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {rankChange > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
            {Math.abs(rankChange)}
          </span>
        )}
      </div>

      {/* Avatar + name + accuracy */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <Avatar className={`${avatarSize} flex-shrink-0 ring-1 ${isCurrentUser ? 'ring-primary/60' : 'ring-border/60'}`}>
          <AvatarImage src={resolveAvatar(user.picture)} />
          <AvatarFallback className="bg-secondary text-foreground font-semibold text-xs">
            {(user.nickname || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className={`font-semibold text-foreground truncate leading-tight ${nameSize}`}>
            {isCurrentUser ? 'You' : (user.nickname || 'Player')}
          </p>
          <p className={`flex items-center gap-1 mt-0.5 ${accSize}`}>
            <Target className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-500 font-semibold tabular-nums">{accuracy}%</span>
          </p>
        </div>
      </div>

      {/* Today */}
      <div className="flex flex-col items-center justify-center">
        {isCurrentUser && (
          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-muted-foreground mb-0.5">Today</span>
        )}
        {todayDelta !== null && todayDelta !== 0 ? (
          <span className={`font-bold tabular-nums text-xs sm:text-sm ${todayDelta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {todayDelta > 0 ? '+' : ''}{todayDelta}
          </span>
        ) : (
          <span className="text-muted-foreground/50 text-xs">—</span>
        )}
      </div>

      {/* Points */}
      <div className="flex flex-col items-center justify-center">
        {isCurrentUser && (
          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-muted-foreground mb-0.5">Points</span>
        )}
        <span className="inline-flex items-center gap-1 sm:gap-1.5">
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400 flex-shrink-0" />
          <span className={`font-extrabold tabular-nums ${ptsSize}`}>{pts.toLocaleString()}</span>
        </span>
      </div>

      {/* Streak */}
      <div className="flex flex-col items-center justify-center">
        {isCurrentUser && (
          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-muted-foreground mb-0.5">Streak</span>
        )}
        <span className="inline-flex items-center gap-1">
          <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-orange-400 text-orange-400 flex-shrink-0" />
          <span className={`font-semibold tabular-nums ${streakSize}`}>{streak}</span>
        </span>
      </div>

      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
};

/* ================= Skeleton row ================= */
const RowSkeleton = () => (
  <div className="grid grid-cols-[38px_1fr_52px_68px_52px_10px] sm:grid-cols-[60px_1fr_72px_100px_72px_16px] gap-1.5 sm:gap-3 items-center px-2 sm:px-5 py-3 sm:py-3.5">
    <div className="w-7 h-5 bg-secondary rounded animate-pulse mx-auto" />
    <div className="flex items-center gap-2 sm:gap-2.5">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-16 sm:w-24 bg-secondary rounded animate-pulse" />
        <div className="h-2 w-10 sm:w-12 bg-secondary rounded animate-pulse" />
      </div>
    </div>
    <div className="h-4 w-8 sm:w-10 bg-secondary rounded animate-pulse mx-auto" />
    <div className="h-4 w-12 sm:w-16 bg-secondary rounded animate-pulse mx-auto" />
    <div className="h-4 w-8 sm:w-10 bg-secondary rounded animate-pulse mx-auto" />
    <div />
  </div>
);

/* ================= Podium Skeleton ================= */
const PodiumSkeleton = () => (
  <div className="flex items-end justify-center gap-3 sm:gap-5 py-10">
    {[2, 1, 3].map((r) => (
      <div key={r} className={`flex flex-col items-center ${r === 1 ? 'order-2' : r === 2 ? 'order-1' : 'order-3'}`}>
        <div className={`${r === 1 ? 'w-[120px] sm:w-[160px]' : 'w-[110px] sm:w-[140px]'} rounded-2xl bg-card/60 border border-border/40 ${r === 1 ? 'h-[220px]' : 'h-[180px]'} animate-pulse`} />
      </div>
    ))}
  </div>
);

/* ================= Main Page ================= */
export const LeaderboardPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('global');
  const [range, setRange] = useState('All time');
  const [globalUsers, setGlobalUsers] = useState([]);
  const [weeklyData, setWeeklyData] = useState(null);
  const [weeklyStatus, setWeeklyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchWeeklyStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/weekly/status`, { credentials: 'include' });
      if (res.ok) setWeeklyStatus(await res.json());
    } catch (e) { /* noop */ }
  }, []);
  const fetchWeekly = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/weekly/leaderboard?limit=50`);
      if (res.ok) setWeeklyData(await res.json());
    } catch (e) { /* noop */ }
  }, []);
  const fetchGlobal = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/football/leaderboard?limit=50`);
      if (res.ok) {
        const d = await res.json();
        setGlobalUsers(d.users || []);
      }
    } catch (e) { /* noop */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([
        fetchWeeklyStatus(),
        activeTab === 'weekly' ? fetchWeekly() : fetchGlobal(),
      ]);
      setLoading(false);
    };
    load();
    // Periodic refresh every 30s
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (activeTab === 'weekly') fetchWeekly();
      else fetchGlobal();
      fetchWeeklyStatus();
    }, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTab, fetchWeekly, fetchGlobal, fetchWeeklyStatus]);

  const users = activeTab === 'weekly' ? (weeklyData?.users || []) : globalUsers;
  const isWeekly = activeTab === 'weekly';
  const top3 = users.slice(0, 3);
  const rest = users.slice(3, 12); // ranks 4..12

  const countdown = useCountdown(weeklyStatus?.ends_in_seconds || 0);
  const seasonStrip = (() => {
    if (activeTab === 'weekly' && countdown.total > 0) {
      return `Season ends in ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`;
    }
    if (activeTab === 'monthly') return 'Monthly competition • Points reset on the 1st';
    return 'All-time rankings • Updated live';
  })();

  const rangeOptions = activeTab === 'global'
    ? ['All time', 'This month', 'This week']
    : activeTab === 'weekly'
      ? ['This week']
      : ['This month'];

  useEffect(() => {
    // Ensure range is valid for selected tab
    if (!rangeOptions.includes(range)) setRange(rangeOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Find current user's entry (top3 + rest is only 12 rows; search full list)
  const currentUserEntry = currentUser
    ? users.find((u) => u.user_id === currentUser.user_id)
    : null;
  const currentUserRank = currentUserEntry
    ? users.findIndex((u) => u.user_id === currentUser.user_id) + 1
    : null;
  const showYouCard = currentUserEntry && currentUserRank > 12;

  return (
    <div className="min-h-screen bg-background" data-testid="leaderboard-page">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-[1040px] pb-24 md:pb-10">
        {/* ============ In-page top bar ============ */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
            data-testid="leaderboard-back"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight" data-testid="leaderboard-title">Leaderboard</h1>
          </div>
          <button className="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="About">
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* ============ Tab pills ============ */}
        <div className="grid grid-cols-3 gap-2 mb-4" data-testid="leaderboard-tabs">
          {[
            { id: 'global', label: 'Global', Icon: Globe },
            { id: 'weekly', label: 'Weekly', Icon: Calendar },
            { id: 'monthly', label: 'Monthly', Icon: BarChart3 },
          ].map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                data-testid={`tab-${id}`}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors duration-150 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_rgba(34,197,94,0.5)]'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* ============ Season strip ============ */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">
              {activeTab === 'weekly' && countdown.total > 0 ? (
                <>
                  Season ends in{' '}
                  <span className="font-bold text-primary tabular-nums">
                    {countdown.days}d {countdown.hours}h {countdown.minutes}m
                  </span>
                </>
              ) : (
                seasonStrip
              )}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/60 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
                data-testid="range-dropdown"
              >
                {range}
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {rangeOptions.map((opt) => (
                <DropdownMenuItem key={opt} onClick={() => setRange(opt)} className="cursor-pointer">
                  {opt}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ============ Podium ============ */}
        {loading ? (
          <PodiumSkeleton />
        ) : top3.length > 0 ? (
          <div className="relative mb-8">
            {/* Ambient glow background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(245,158,11,0.1)_0%,transparent_55%)]" />
            <div className="relative flex items-end justify-center gap-3 sm:gap-5 py-4 sm:py-6">
              {top3[1] && <PodiumCard user={top3[1]} rank={2} isWeekly={isWeekly} />}
              {top3[0] && <PodiumCard user={top3[0]} rank={1} isWeekly={isWeekly} />}
              {top3[2] && <PodiumCard user={top3[2]} rank={3} isWeekly={isWeekly} />}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center" data-testid="leaderboard-empty">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/40 mb-4">
              <Trophy className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground font-medium">
              {isWeekly ? 'No points earned this week yet.' : 'No rankings yet.'}
            </p>
            <p className="text-muted-foreground/60 text-sm mt-1">Be the first to climb the ranks!</p>
          </div>
        )}

        {/* ============ Table Header ============ */}
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-[38px_1fr_52px_68px_52px_10px] sm:grid-cols-[60px_1fr_72px_100px_72px_16px] gap-1.5 sm:gap-3 px-2 sm:px-5 py-2 text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] sm:tracking-[0.15em] border-b border-border/50">
            <span className="text-center">Rank</span>
            <span>Player</span>
            <span className="text-center">Today</span>
            <span className="text-center">Points</span>
            <span className="text-center">Streak</span>
            <span />
          </div>
        )}

        {/* ============ Rank List ============ */}
        <div className="mt-2 space-y-1.5" data-testid="ranking-list">
          {loading ? (
            <>{[...Array(6)].map((_, i) => <RowSkeleton key={i} />)}</>
          ) : (
            <>
              {rest.map((u, i) => {
                const rank = i + 4;
                const isMe = currentUser?.user_id === u.user_id;
                return (
                  <RankRow
                    key={u.user_id}
                    user={u}
                    rank={rank}
                    isCurrentUser={isMe}
                    isWeekly={isWeekly}
                    onClick={() => u.user_id && navigate(`/profile/${u.user_id}`)}
                  />
                );
              })}
              {users.length > 0 && rest.length === 0 && top3.length < 4 && (
                <div className="py-8 text-center text-muted-foreground/70 text-sm">
                  Only {users.length} {users.length === 1 ? 'player' : 'players'} on the board so far.
                </div>
              )}
            </>
          )}
        </div>

        {/* ============ "YOU" floating card (when current user is outside top 12) ============ */}
        {showYouCard && (
          <div className="mt-4" data-testid="you-card">
            <div className="relative pt-4">
              {/* YOU badge */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10">
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_4px_14px_rgba(34,197,94,0.45)]">
                  You
                </span>
              </div>
              <RankRow
                user={currentUserEntry}
                rank={currentUserRank}
                isCurrentUser={true}
                isWeekly={isWeekly}
                onClick={() => navigate('/profile')}
              />
            </div>
          </div>
        )}

        {/* Refreshing indicator */}
        {loading && users.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Refreshing…
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;
