import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  LayoutDashboard, Users, Trophy, ShieldAlert, Bell, BarChart3,
  Search, ChevronLeft, ChevronRight, Loader2, Shield, ShieldOff,
  Ban, UserX, RotateCcw, Eye, Send, Megaphone, Pin, PinOff,
  Trash2, Flag, RefreshCw, AlertTriangle, Check, X, Clock,
  Activity, MessageSquare, Heart, TrendingUp, ScrollText
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = (path, opts = {}) =>
  fetch(`${API_URL}/api/admin${path}`, { credentials: 'include', ...opts }).then(async r => {
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || `Error ${r.status}`);
    }
    return r.json();
  });

/* ─── Animated Counter ─── */
const AnimatedCounter = ({ value, duration = 800 }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = display;
    const end = value;
    if (start === end) return;
    const step = Math.max(1, Math.ceil(Math.abs(end - start) / 40));
    let current = start;
    const dir = end > start ? 1 : -1;
    clearInterval(ref.current);
    ref.current = setInterval(() => {
      current += step * dir;
      if ((dir === 1 && current >= end) || (dir === -1 && current <= end)) {
        current = end;
        clearInterval(ref.current);
      }
      setDisplay(current);
    }, duration / 40);
    return () => clearInterval(ref.current);
  }, [value]);
  return <span className="tabular-nums">{display.toLocaleString()}</span>;
};

/* ─── Stat Card ─── */
const StatCard = ({ icon: Icon, label, value, color = 'primary', sub }) => (
  <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-5 hover:border-border/70 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
    <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/[0.04] -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform duration-500" />
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
      color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' :
      color === 'amber' ? 'bg-amber-500/10 text-amber-500' :
      color === 'red' ? 'bg-red-500/10 text-red-500' :
      color === 'sky' ? 'bg-sky-500/10 text-sky-500' :
      'bg-primary/10 text-primary'
    }`}>
      <Icon className="w-5 h-5" />
    </div>
    <p className="text-2xl font-bold text-foreground leading-none"><AnimatedCounter value={value} /></p>
    <p className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</p>
    {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
  </div>
);

/* ─── Simple Bar Chart ─── */
const MiniBarChart = ({ data, label }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
      <p className="text-sm font-semibold text-foreground mb-4">{label}</p>
      <div className="flex items-end gap-1.5 h-28">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative rounded-t-md overflow-hidden bg-secondary/30" style={{ height: '100px' }}>
              <div
                className="absolute bottom-0 w-full bg-primary/70 rounded-t-md transition-all duration-700 ease-out"
                style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, animationDelay: `${i * 80}ms` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Confirm Dialog ─── */
const ConfirmDialog = ({ open, onClose, onConfirm, title, message, variant = 'destructive' }) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className={`w-5 h-5 ${variant === 'destructive' ? 'text-red-500' : 'text-amber-500'}`} />
          {title}
        </DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">{message}</p>
      <DialogFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant={variant} size="sm" onClick={onConfirm} data-testid="confirm-action-btn">Confirm</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

/* ═══ TABS ═══ */
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'matches', label: 'Matches', icon: Trophy },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

/* ═══════════ DASHBOARD TAB ═══════════ */
const DashboardTab = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    Promise.all([
      api('/dashboard'),
      api('/audit-log?limit=5')
    ]).then(([s, a]) => {
      setStats(s);
      setAuditLogs(a.logs || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!stats) return <p className="text-center text-muted-foreground py-10">Failed to load dashboard</p>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="admin-dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={stats.total_users} color="primary" />
        <StatCard icon={Activity} label="Online Now" value={stats.active_users} color="emerald" />
        <StatCard icon={Trophy} label="Total Matches" value={stats.total_matches} color="amber" />
        <StatCard icon={TrendingUp} label="Predictions" value={stats.total_predictions} color="sky" />
        <StatCard icon={MessageSquare} label="Messages" value={stats.total_messages} />
        <StatCard icon={Heart} label="Friendships" value={stats.total_friendships} color="red" />
        <StatCard icon={Bell} label="Notifications" value={stats.total_notifications} color="amber" />
        <StatCard icon={Shield} label="Admins" value={stats.admin_count} color="emerald" sub={`${stats.banned_users} banned`} />
      </div>

      {/* System Status */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2.5 h-2.5 rounded-full ${stats.system_status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm font-semibold">System Status: <span className="text-emerald-500 capitalize">{stats.system_status}</span></span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div>New users (24h): <span className="text-foreground font-medium">{stats.new_users_24h}</span></div>
          <div>Banned: <span className="text-foreground font-medium">{stats.banned_users}</span></div>
          <div>Active admins: <span className="text-foreground font-medium">{stats.admin_count}</span></div>
        </div>
      </div>

      {/* Recent Audit Log */}
      {auditLogs.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ScrollText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Recent Admin Actions</span>
          </div>
          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.log_id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/20 last:border-0">
                <span className="text-muted-foreground w-28 shrink-0">{new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="font-medium text-foreground">{log.admin_nickname}</span>
                <span className="text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">{log.action}</span>
                {log.target && <span className="text-muted-foreground truncate">{log.target}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════ USERS TAB ═══════════ */
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api(`/users?page=${page}&search=${encodeURIComponent(search)}&limit=15`).then(d => {
      setUsers(d.users || []);
      setTotal(d.total || 0);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const doAction = async (action, userId, name) => {
    setActionLoading(userId + action);
    try {
      if (action === 'delete') await api(`/users/${userId}`, { method: 'DELETE' });
      else await api(`/users/${userId}/${action}`, { method: 'POST' });
      fetchUsers();
      setConfirm(null);
    } catch (e) { alert(e.message); }
    finally { setActionLoading(''); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300" data-testid="admin-users">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm bg-secondary/50"
            data-testid="admin-users-search"
          />
        </div>
        <span className="text-xs text-muted-foreground">{total} users total</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-2xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Pts</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Lvl</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Role</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors" data-testid={`user-row-${u.user_id}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={u.picture?.startsWith('/') ? `${API_URL}${u.picture}` : u.picture} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            {(u.nickname || u.email || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{u.nickname || 'No nickname'}</p>
                          <p className="text-[10px] text-muted-foreground">{u.user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{u.email}</td>
                    <td className="px-4 py-2.5 text-center font-medium">{u.points || 0}</td>
                    <td className="px-4 py-2.5 text-center font-medium">{u.level || 0}</td>
                    <td className="px-4 py-2.5 text-center">
                      {u.is_banned ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">BANNED</span>
                      ) : u.is_online ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">ONLINE</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 text-[10px] font-bold">OFFLINE</span>
                      )}
                      {u.is_flagged && <span className="ml-1 text-amber-400" title="Flagged"><Flag className="w-3 h-3 inline" /></span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {u.role === 'admin' ? (
                        <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">ADMIN</span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">User</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {u.role !== 'admin' ? (
                          <button onClick={() => setConfirm({ action: 'promote', userId: u.user_id, name: u.nickname })} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Promote"><Shield className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button onClick={() => setConfirm({ action: 'demote', userId: u.user_id, name: u.nickname })} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-colors" title="Demote"><ShieldOff className="w-3.5 h-3.5" /></button>
                        )}
                        {!u.is_banned ? (
                          <button onClick={() => setConfirm({ action: 'ban', userId: u.user_id, name: u.nickname })} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Ban"><Ban className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button onClick={() => doAction('unban', u.user_id)} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors" title="Unban"><Check className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => setConfirm({ action: 'reset-points', userId: u.user_id, name: u.nickname })} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-colors" title="Reset Points"><RotateCcw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirm({ action: 'delete', userId: u.user_id, name: u.nickname })} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-secondary/10">
            <span className="text-xs text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(total / 15))}</span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="users-prev"><ChevronLeft className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} data-testid="users-next"><ChevronRight className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          open={true}
          onClose={() => setConfirm(null)}
          onConfirm={() => doAction(confirm.action, confirm.userId, confirm.name)}
          title={`${confirm.action.replace('-', ' ')} user?`}
          message={`Are you sure you want to ${confirm.action.replace('-', ' ')} ${confirm.name || confirm.userId}? This action will be logged.`}
          variant={confirm.action === 'delete' || confirm.action === 'ban' ? 'destructive' : 'default'}
        />
      )}
    </div>
  );
};

/* ═══════════ MATCHES TAB ═══════════ */
const MatchesTab = () => {
  const [matches, setMatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = useCallback(() => {
    setLoading(true);
    api(`/matches?page=${page}&search=${encodeURIComponent(search)}&limit=15`).then(d => {
      setMatches(d.matches || []);
      setTotal(d.total || 0);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api('/matches/refresh', { method: 'POST' });
      fetchMatches();
    } catch (e) { alert(e.message); }
    finally { setRefreshing(false); }
  };

  const togglePin = async (id) => {
    try {
      await api(`/matches/${id}/pin`, { method: 'POST' });
      fetchMatches();
    } catch (e) { alert(e.message); }
  };

  const hideMatch = async (id) => {
    try {
      await api(`/matches/${id}`, { method: 'DELETE' });
      fetchMatches();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300" data-testid="admin-matches">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search matches..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm bg-secondary/50" data-testid="admin-matches-search" />
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="gap-2" data-testid="refresh-matches-btn">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Force Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-2">
          {matches.map(m => (
            <div key={m.id} className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors ${m.is_pinned ? 'border-primary/40 bg-primary/5' : 'border-border/30 bg-card/40 hover:bg-secondary/20'}`} data-testid={`match-row-${m.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">{m.competition}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    m.status === 'LIVE' ? 'bg-red-500/20 text-red-400' :
                    m.status === 'FINISHED' ? 'bg-zinc-500/20 text-zinc-400' :
                    'bg-sky-500/15 text-sky-400'
                  }`}>{m.status === 'LIVE' ? 'LIVE' : m.status === 'FINISHED' ? 'FT' : m.status}</span>
                  {m.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium truncate">{m.homeTeam?.name}</span>
                  {m.score && m.score.home !== null && (
                    <span className="font-bold tabular-nums text-foreground">{m.score.home} - {m.score.away}</span>
                  )}
                  <span className="font-medium truncate">{m.awayTeam?.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => togglePin(m.id)} className={`p-1.5 rounded-lg transition-colors ${m.is_pinned ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground'}`} title={m.is_pinned ? 'Unpin' : 'Pin'}>
                  {m.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => hideMatch(m.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Hide">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {matches.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">No matches found</p>}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{total} matches</span>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════ MODERATION TAB ═══════════ */
const ModerationTab = () => {
  const [messages, setMessages] = useState([]);
  const [reported, setReported] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('recent');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api('/moderation/messages?limit=30'),
      api('/moderation/reported')
    ]).then(([m, r]) => {
      setMessages(m.messages || []);
      setReported(r.reports || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const deleteMsg = async (id) => {
    try {
      await api(`/moderation/messages/${id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.message_id !== id));
    } catch (e) { alert(e.message); }
  };

  const flagUser = async (userId) => {
    try {
      await api(`/moderation/users/${userId}/flag`, { method: 'POST' });
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300" data-testid="admin-moderation">
      <div className="flex gap-2">
        <Button variant={tab === 'recent' ? 'default' : 'outline'} size="sm" onClick={() => setTab('recent')} className="gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />Recent Messages
        </Button>
        <Button variant={tab === 'reported' ? 'default' : 'outline'} size="sm" onClick={() => setTab('reported')} className="gap-1.5">
          <Flag className="w-3.5 h-3.5" />Reported ({reported.length})
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : tab === 'recent' ? (
        <div className="rounded-2xl border border-border/40 divide-y divide-border/20 overflow-hidden">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">No messages</p>
          ) : messages.map(m => (
            <div key={m.message_id} className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/10 transition-colors" data-testid={`mod-msg-${m.message_id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-primary">{m.sender_nickname}</span>
                  <span className="text-[10px] text-muted-foreground">&rarr;</span>
                  <span className="text-xs font-medium text-foreground">{m.receiver_nickname}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{new Date(m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{m.message}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => flagUser(m.sender_id)} className="p-1 rounded hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500" title="Flag sender"><Flag className="w-3 h-3" /></button>
                <button onClick={() => deleteMsg(m.message_id)} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500" title="Delete"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 divide-y divide-border/20 overflow-hidden">
          {reported.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">No reported messages</p>
          ) : reported.map(r => (
            <div key={r.message_id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-red-400">Reported</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${r.status === 'pending' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{r.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">{r.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Reason: {r.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════ NOTIFICATIONS TAB ═══════════ */
const NotificationsTab = () => {
  const [mode, setMode] = useState('broadcast');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      if (mode === 'broadcast') {
        const r = await api('/notifications/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        setResult({ ok: true, msg: `Sent to ${r.sent_to} users` });
      } else {
        if (!userId.trim()) { alert('User ID required'); setSending(false); return; }
        await api('/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, message })
        });
        setResult({ ok: true, msg: 'Notification sent' });
      }
      setMessage('');
    } catch (e) { setResult({ ok: false, msg: e.message }); }
    finally { setSending(false); }
  };

  return (
    <div className="max-w-lg space-y-5 animate-in fade-in duration-300" data-testid="admin-notifications">
      <div className="flex gap-2">
        <Button variant={mode === 'broadcast' ? 'default' : 'outline'} size="sm" onClick={() => setMode('broadcast')} className="gap-1.5">
          <Megaphone className="w-3.5 h-3.5" />Broadcast
        </Button>
        <Button variant={mode === 'user' ? 'default' : 'outline'} size="sm" onClick={() => setMode('user')} className="gap-1.5">
          <Send className="w-3.5 h-3.5" />To User
        </Button>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        {mode === 'user' && (
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">User ID</label>
            <Input value={userId} onChange={e => setUserId(e.target.value)} placeholder="user_xxx..." className="h-9 text-sm bg-secondary/50" data-testid="notif-user-id" />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-foreground mb-1.5 block">
            {mode === 'broadcast' ? 'Broadcast Message' : 'Notification Message'}
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your notification..."
            className="w-full h-24 px-3 py-2 rounded-xl border border-border/40 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 resize-none"
            maxLength={500}
            data-testid="notif-message"
          />
        </div>
        <Button onClick={send} disabled={sending || !message.trim()} className="gap-2" data-testid="send-notification-btn">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {mode === 'broadcast' ? 'Send to All Users' : 'Send Notification'}
        </Button>
        {result && (
          <p className={`text-xs font-medium ${result.ok ? 'text-emerald-500' : 'text-red-500'}`}>{result.msg}</p>
        )}
      </div>
    </div>
  );
};

/* ═══════════ ANALYTICS TAB ═══════════ */
const AnalyticsTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/analytics').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-10">Failed to load analytics</p>;

  return (
    <div className="space-y-5 animate-in fade-in duration-300" data-testid="admin-analytics">
      <div className="grid md:grid-cols-2 gap-4">
        <MiniBarChart data={data.daily_users} label="Daily Active Users (7 days)" />
        <MiniBarChart data={data.daily_predictions} label="Predictions per Day (7 days)" />
      </div>

      {/* Top Predictors */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Top Predictors</p>
        {data.top_predictors.length === 0 ? (
          <p className="text-xs text-muted-foreground">No prediction data yet</p>
        ) : (
          <div className="space-y-2">
            {data.top_predictors.map((p, i) => (
              <div key={p.user_id} className="flex items-center gap-3 text-xs">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                  i === 0 ? 'bg-amber-500/20 text-amber-400' :
                  i === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                  i === 2 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-secondary text-muted-foreground'
                }`}>{i + 1}</span>
                <span className="flex-1 font-medium text-foreground">{p.nickname}</span>
                <span className="text-muted-foreground">{p.count} predictions</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Points Distribution */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Points Distribution</p>
        <div className="flex items-end gap-3 h-24">
          {data.points_distribution.map((p, i) => {
            const max = Math.max(...data.points_distribution.map(d => d.count), 1);
            return (
              <div key={p.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-foreground">{p.count}</span>
                <div className="w-full bg-secondary/30 rounded-t-md" style={{ height: '60px', position: 'relative' }}>
                  <div className="absolute bottom-0 w-full bg-primary/60 rounded-t-md transition-all duration-700" style={{ height: `${Math.max(4, (p.count / max) * 100)}%` }} />
                </div>
                <span className="text-[8px] text-muted-foreground">{p.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ═══════════ MAIN ADMIN PAGE ═══════════ */
export const AdminPage = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="admin-page">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4" data-testid="admin-forbidden">
        <ShieldAlert className="w-16 h-16 text-red-500/40" />
        <h1 className="text-xl font-bold text-foreground">Access Denied</h1>
        <p className="text-sm text-muted-foreground">You don't have permission to access the admin panel.</p>
        <Button variant="outline" onClick={() => navigate('/')} data-testid="go-home-btn">Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="admin-page">
      <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      <div className="flex" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Sidebar Nav */}
        <nav className="w-14 md:w-56 shrink-0 border-r border-border/40 bg-card/30 flex flex-col overflow-hidden" data-testid="admin-sidebar">
          <div className="hidden md:flex items-center gap-2 px-5 py-4 border-b border-border/30">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Admin Panel</span>
          </div>
          <div className="flex-1 py-2 space-y-0.5 overflow-y-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 md:px-5 py-2.5 text-xs font-medium transition-all duration-150 ${
                  activeTab === t.id
                    ? 'text-primary bg-primary/[0.08] border-r-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                }`}
                data-testid={`admin-tab-${t.id}`}
              >
                <t.icon className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6" data-testid="admin-content">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-lg font-bold text-foreground capitalize">{activeTab}</h1>
              <span className="text-[10px] text-muted-foreground hidden md:block">Logged in as {user?.nickname || user?.email}</span>
            </div>

            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'matches' && <MatchesTab />}
            {activeTab === 'moderation' && <ModerationTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
