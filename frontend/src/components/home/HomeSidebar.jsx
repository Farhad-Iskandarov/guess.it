import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Target, TrendingUp, Flame, Crown, Gift } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/* ========== Stat tile ========== */
const StatTile = ({ icon: Icon, iconBg, iconColor, label, value }) => (
  <div className="flex items-start gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <Icon className={`w-4 h-4 ${iconColor}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{value}</p>
    </div>
  </div>
);

/* ========== Your Stats card ========== */
const YourStatsCard = ({ isAuthenticated }) => {
  const [stats, setStats] = useState({ points: 0, correct: 0, accuracy: 0, streak: 0 });

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) {
      setStats({ points: 0, correct: 0, accuracy: 0, streak: 0 });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/profile/bundle`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const s = data?.predictions?.summary || {};
      const correct = s.correct || 0;
      const wrong = s.wrong || 0;
      const total = correct + wrong;
      setStats({
        points: s.points || 0,
        correct,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        streak: s.streak || 0,
      });
    } catch (e) { /* noop */ }
  }, [isAuthenticated]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm" data-testid="sidebar-stats">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground text-base">Your Stats</h3>
        <Link to="/profile" className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <StatTile
          icon={Trophy}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
          label="Total Points"
          value={stats.points.toLocaleString()}
        />
        <StatTile
          icon={Target}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          label="Correct Predictions"
          value={stats.correct}
        />
        <StatTile
          icon={TrendingUp}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          label="Accuracy"
          value={`${stats.accuracy}%`}
        />
        <StatTile
          icon={Flame}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
          label="Win Streak"
          value={stats.streak}
        />
      </div>
    </div>
  );
};

/* ========== Leaderboard mini card ========== */
const LeaderboardMiniCard = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchLb = async () => {
      try {
        const res = await fetch(`${API_URL}/api/football/leaderboard?limit=5`);
        if (!res.ok) return;
        const d = await res.json();
        setUsers(d.users || []);
      } catch (e) { /* noop */ }
    };
    fetchLb();
    const t = setInterval(fetchLb, 60000);
    return () => clearInterval(t);
  }, []);

  const resolveAvatar = (p) => (p?.startsWith('/') ? `${API_URL}${p}` : p);

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm" data-testid="sidebar-leaderboard">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-foreground text-base">Leaderboard</h3>
        <Link to="/leaderboard" className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
          View All
        </Link>
      </div>
      {users.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No rankings yet</div>
      ) : (
        <ul className="divide-y divide-border/40">
          {users.map((u, idx) => {
            const rank = idx + 1;
            return (
              <li key={u.user_id} className="flex items-center gap-3 py-3 first:pt-2 last:pb-1">
                {rank <= 3 ? (
                  <Crown className={`w-4 h-4 flex-shrink-0 ${
                    rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-400' : 'text-orange-500'
                  }`} />
                ) : (
                  <span className="w-4 text-center text-xs font-bold text-muted-foreground">{rank}</span>
                )}
                <Avatar className="w-9 h-9 flex-shrink-0 ring-1 ring-border/60">
                  <AvatarImage src={resolveAvatar(u.picture)} />
                  <AvatarFallback className="bg-secondary text-foreground font-semibold text-xs">
                    {(u.nickname || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-semibold text-foreground truncate">
                  {u.nickname || 'Player'}
                </span>
                <span className="text-sm font-bold text-primary tabular-nums whitespace-nowrap">
                  {(u.points || 0).toLocaleString()} pts
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/* ========== Promo card ========== */
const PROMO_JERSEY = 'https://images.unsplash.com/photo-1616124619460-ff4ed8f4683c?auto=format&fit=crop&w=400&q=75';

const PromoCard = () => (
  <Link
    to="/subscribe"
    className="block relative overflow-hidden rounded-2xl bg-[#0B4A2A] text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
    data-testid="sidebar-promo"
  >
    <div className="grid grid-cols-[1fr_112px] gap-3 items-stretch">
      {/* Left: text */}
      <div className="p-5 pr-0">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
            <Gift className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="font-extrabold text-[15px] leading-tight text-emerald-300">Predict. Compete. Win.</p>
            <p className="text-[12px] mt-2 text-primary-foreground/90 leading-snug">
              Top 1 on the leaderboard wins the jersey of your favourite club!
            </p>
          </div>
        </div>
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-md">
            Learn More
          </span>
        </div>
      </div>
      {/* Right: jersey image */}
      <div className="relative overflow-hidden">
        <img
          src={PROMO_JERSEY}
          alt="Club jersey"
          className="absolute inset-0 w-full h-full object-cover object-center"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        {/* Soft gradient to blend into card background */}
        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0B4A2A] to-transparent pointer-events-none" />
      </div>
    </div>
  </Link>
);

/* ========== Main Sidebar (desktop-only container is handled by parent) ========== */
export const HomeSidebar = ({ isAuthenticated }) => {
  return (
    <aside className="flex flex-col gap-5" data-testid="home-sidebar">
      <YourStatsCard isAuthenticated={isAuthenticated} />
      <LeaderboardMiniCard />
      <PromoCard />
    </aside>
  );
};

export default HomeSidebar;
