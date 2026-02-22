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
  LayoutDashboard, Users, Trophy, Bell, BarChart3,
  Search, ChevronLeft, ChevronRight, Loader2, Shield, ShieldOff,
  Ban, UserX, RotateCcw, Eye, Send, Megaphone, Pin, PinOff,
  Trash2, RefreshCw, AlertTriangle, Check, X, Clock,
  Activity, MessageSquare, Heart, TrendingUp, ScrollText,
  Server, Star, StarOff, Flame, Lock, KeyRound, Filter,
  ChevronDown, ArrowUpDown, Plus, Power, PowerOff, Zap,
  UserCheck, Edit, Mail, Newspaper
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

/* --- Animated Counter --- */
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

/* --- Stat Card --- */
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

/* --- Mini Bar Chart --- */
const MiniBarChart = ({ data, label }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
      <p className="text-sm font-semibold text-foreground mb-4">{label}</p>
      <div className="flex items-end gap-1.5 h-28">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative rounded-t-md overflow-hidden bg-secondary/30" style={{ height: '100px' }}>
              <div className="absolute bottom-0 w-full bg-primary/70 rounded-t-md transition-all duration-700 ease-out" style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }} />
            </div>
            <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* --- Confirm Dialog --- */
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

/* --- TABS --- */
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'matches', label: 'Matches', icon: Trophy },
  { id: 'points', label: 'Points Settings', icon: Zap },
  { id: 'banners', label: 'Carousel Banners', icon: ScrollText },
  { id: 'news', label: 'News', icon: Edit },
  { id: 'subscriptions', label: 'Subscribed Emails', icon: Mail },
  { id: 'contact-msgs', label: 'Contact Messages', icon: MessageSquare },
  { id: 'contact-settings', label: 'Contact Settings', icon: KeyRound },
  { id: 'system', label: 'System', icon: Server },
  { id: 'streaks', label: 'Prediction Monitor', icon: Flame },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

/* ============ DASHBOARD TAB ============ */
const DashboardTab = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    Promise.all([api('/dashboard'), api('/audit-log?limit=5')])
      .then(([s, a]) => { setStats(s); setAuditLogs(a.logs || []); })
      .catch(console.error).finally(() => setLoading(false));
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

/* ============ USERS TAB ============ */
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // Dialogs
  const [passwordDialog, setPasswordDialog] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [messagesDialog, setMessagesDialog] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [chatDialog, setChatDialog] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [userDetail, setUserDetail] = useState(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    let url = `/users?page=${page}&search=${encodeURIComponent(search)}&limit=15&sort_by=points&sort_order=desc`;
    if (filterStatus) url += `&filter_status=${filterStatus}`;
    api(url).then(d => {
      setUsers(d.users || []);
      setTotal(d.total || 0);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page, search, filterStatus]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const doAction = async (action, userId) => {
    try {
      if (action === 'delete') await api(`/users/${userId}`, { method: 'DELETE' });
      else await api(`/users/${userId}/${action}`, { method: 'POST' });
      fetchUsers();
      setConfirm(null);
    } catch (e) { alert(e.message); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) { alert('Password must be at least 8 characters'); return; }
    setPasswordLoading(true);
    try {
      await api(`/users/${passwordDialog.userId}/change-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword })
      });
      alert('Password changed successfully. User sessions invalidated.');
      setPasswordDialog(null);
      setNewPassword('');
    } catch (e) { alert(e.message); }
    finally { setPasswordLoading(false); }
  };

  const openMessages = async (userId, nickname) => {
    setMessagesDialog({ userId, nickname });
    setChatLoading(true);
    try {
      const data = await api(`/users/${userId}/conversations`);
      setConversations(data.conversations || []);
    } catch (e) { alert(e.message); setMessagesDialog(null); }
    finally { setChatLoading(false); }
  };

  const openChat = async (userId, otherId, otherNick) => {
    setChatDialog({ userId, otherId, otherNick });
    setChatLoading(true);
    try {
      const data = await api(`/users/${userId}/messages/${otherId}?limit=100`);
      setChatMessages(data.messages || []);
    } catch (e) { alert(e.message); }
    finally { setChatLoading(false); }
  };

  const openUserDetail = async (userId) => {
    try {
      const data = await api(`/users/${userId}`);
      setUserDetail(data);
    } catch (e) { alert(e.message); }
  };

  const filterOptions = [
    { value: '', label: 'All Users' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
    { value: 'banned', label: 'Banned' },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300" data-testid="admin-users">
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm bg-secondary/50" data-testid="admin-users-search" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5" data-testid="filter-toggle-btn">
            <Filter className="w-3.5 h-3.5" />Filters
            {filterStatus && <span className="w-2 h-2 rounded-full bg-primary" />}
          </Button>
          <span className="text-xs text-muted-foreground">{total} users (sorted by points)</span>
        </div>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 animate-in fade-in duration-200" data-testid="filter-chips">
          {filterOptions.map(f => (
            <button key={f.value} onClick={() => { setFilterStatus(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === f.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`} data-testid={`filter-${f.value || 'all'}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

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
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">Pts <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Lvl</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors" data-testid={`user-row-${u.user_id}`}>
                    <td className="px-4 py-2.5">
                      <button onClick={() => openUserDetail(u.user_id)} className="flex items-center gap-2.5 text-left hover:opacity-80">
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
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{u.email}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-primary">{u.points || 0}</td>
                    <td className="px-4 py-2.5 text-center font-medium">{u.level || 0}</td>
                    <td className="px-4 py-2.5 text-center">
                      {u.is_banned ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">BANNED</span>
                      ) : u.is_online ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">ONLINE</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 text-[10px] font-bold">OFFLINE</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* Eye - View Messages */}
                        <button onClick={() => openMessages(u.user_id, u.nickname)} className="p-1.5 rounded-lg hover:bg-sky-500/10 text-muted-foreground hover:text-sky-500 transition-colors" title="View Messages" data-testid={`view-messages-${u.user_id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {/* Change Password */}
                        <button onClick={() => { setPasswordDialog({ userId: u.user_id, nickname: u.nickname }); setNewPassword(''); }} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-colors" title="Change Password" data-testid={`change-pwd-${u.user_id}`}>
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {/* Ban / Unban */}
                        {!u.is_banned ? (
                          <button onClick={() => setConfirm({ action: 'ban', userId: u.user_id, name: u.nickname })} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Ban" data-testid={`ban-${u.user_id}`}>
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => doAction('unban', u.user_id)} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors" title="Unban" data-testid={`unban-${u.user_id}`}>
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Delete */}
                        <button onClick={() => setConfirm({ action: 'delete', userId: u.user_id, name: u.nickname })} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete" data-testid={`delete-${u.user_id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-secondary/10">
            <span className="text-xs text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(total / 15))}</span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="users-prev"><ChevronLeft className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} data-testid="users-next"><ChevronRight className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog open={true} onClose={() => setConfirm(null)}
          onConfirm={() => doAction(confirm.action, confirm.userId)}
          title={`${confirm.action.replace('-', ' ')} user?`}
          message={`Are you sure you want to ${confirm.action.replace('-', ' ')} ${confirm.name || confirm.userId}? This action will be logged.`}
          variant={confirm.action === 'delete' || confirm.action === 'ban' ? 'destructive' : 'default'}
        />
      )}

      {/* Password Change Dialog */}
      <Dialog open={!!passwordDialog} onOpenChange={() => setPasswordDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Lock className="w-5 h-5 text-amber-500" />
              Change Password for {passwordDialog?.nickname}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Set a new password. No current password required. User sessions will be invalidated.</p>
            <Input type="password" placeholder="New password (min 8 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-9 text-sm" data-testid="new-password-input" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPasswordDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={handleChangePassword} disabled={passwordLoading || newPassword.length < 8} data-testid="confirm-password-btn">
              {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversations Dialog (Eye icon) */}
      <Dialog open={!!messagesDialog} onOpenChange={() => { setMessagesDialog(null); setChatDialog(null); setConversationSearch(''); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="w-5 h-5 text-sky-500" />
              {chatDialog ? `Chat: ${messagesDialog?.nickname} & ${chatDialog.otherNick}` : `Conversations of ${messagesDialog?.nickname}`}
            </DialogTitle>
          </DialogHeader>
          {/* Search bar for conversations */}
          {!chatDialog && messagesDialog && (
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={conversationSearch}
                  onChange={(e) => setConversationSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  data-testid="conversation-search-input"
                />
                {conversationSearch && (
                  <button
                    onClick={() => setConversationSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto min-h-0">
            {chatLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : chatDialog ? (
              /* Chat view */
              <div className="space-y-2 p-2">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">No messages</p>
                ) : chatMessages.map(m => (
                  <div key={m.message_id} className={`flex ${m.sender_id === messagesDialog.userId ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs ${
                      m.sender_id === messagesDialog.userId
                        ? 'bg-primary/15 text-foreground'
                        : 'bg-secondary text-foreground'
                    }`}>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                        {m.sender_id === messagesDialog.userId ? messagesDialog.nickname : chatDialog.otherNick}
                      </p>
                      <p>{m.message}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-1">
                        {new Date(m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Conversations list */
              <div className="divide-y divide-border/20">
                {(() => {
                  const filteredConversations = conversations.filter(c =>
                    c.partner_nickname?.toLowerCase().includes(conversationSearch.toLowerCase()) ||
                    c.last_message?.toLowerCase().includes(conversationSearch.toLowerCase())
                  );
                  
                  if (filteredConversations.length === 0) {
                    return <p className="text-center text-muted-foreground text-sm py-8">
                      {conversationSearch ? 'No conversations found' : 'No conversations'}
                    </p>;
                  }
                  
                  return filteredConversations.map(c => (
                    <button key={c.partner_id} onClick={() => openChat(messagesDialog.userId, c.partner_id, c.partner_nickname)}
                      className="w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/20 transition-colors text-left" data-testid={`conv-${c.partner_id}`}>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={c.partner_picture?.startsWith('/') ? `${API_URL}${c.partner_picture}` : c.partner_picture} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{(c.partner_nickname || '?')[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{c.partner_nickname}</span>
                          {c.partner_online && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{c.last_message}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-muted-foreground">{c.message_count} msgs</span>
                      </div>
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>
          {chatDialog && (
            <div className="pt-2 border-t border-border/30">
              <Button variant="outline" size="sm" onClick={() => setChatDialog(null)} className="gap-1">
                <ChevronLeft className="w-3 h-3" />Back to conversations
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1">Read-only view. Admin cannot send messages.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog open={!!userDetail} onOpenChange={() => setUserDetail(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">User Detail: {userDetail?.nickname || userDetail?.email}</DialogTitle>
          </DialogHeader>
          {userDetail && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={userDetail.picture?.startsWith('/') ? `${API_URL}${userDetail.picture}` : userDetail.picture} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{(userDetail.nickname || 'U')[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground text-sm">{userDetail.nickname}</p>
                  <p className="text-muted-foreground">{userDetail.email}</p>
                  <p className="text-[10px] text-muted-foreground">{userDetail.user_id}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-primary">{userDetail.points || 0}</p>
                  <p className="text-muted-foreground">Points</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-amber-500">{userDetail.level || 0}</p>
                  <p className="text-muted-foreground">Level</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-emerald-500">{userDetail.predictions_count || 0}</p>
                  <p className="text-muted-foreground">Predictions</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Correct</span><span className="font-medium text-emerald-500">{userDetail.correct_predictions}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Wrong</span><span className="font-medium text-red-400">{userDetail.wrong_predictions}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Messages Sent</span><span className="font-medium">{userDetail.messages_sent}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Messages Received</span><span className="font-medium">{userDetail.messages_received}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Friends</span><span className="font-medium">{userDetail.friends_count}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Notifications</span><span className="font-medium">{userDetail.notifications_count}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Pending In</span><span className="font-medium">{userDetail.pending_requests_in}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Pending Out</span><span className="font-medium">{userDetail.pending_requests_out}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Active Sessions</span><span className="font-medium">{userDetail.active_sessions}</span></div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg"><span className="text-muted-foreground">Status</span>
                  <span className={`font-medium ${userDetail.is_banned ? 'text-red-400' : userDetail.is_online ? 'text-emerald-500' : 'text-zinc-400'}`}>
                    {userDetail.is_banned ? 'Banned' : userDetail.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded-lg col-span-2"><span className="text-muted-foreground">Joined</span><span className="font-medium">{userDetail.created_at ? new Date(userDetail.created_at).toLocaleDateString() : 'N/A'}</span></div>
              </div>
              {/* Friends list */}
              {userDetail.friends && userDetail.friends.length > 0 && (
                <div>
                  <p className="font-semibold text-foreground mb-2">Friends ({userDetail.friends.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {userDetail.friends.slice(0, 20).map(f => (
                      <span key={f.user_id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/50 text-[10px]">
                        <span className={`w-1.5 h-1.5 rounded-full ${f.is_online ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                        {f.nickname || f.user_id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* View Predictions Button */}
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full gap-2" 
                onClick={async () => {
                  try {
                    const data = await api(`/users/${userDetail.user_id}/predictions?limit=100`);
                    setUserDetail(prev => ({ ...prev, predictions: data.predictions || [], showPredictions: true, predictionSearch: '' }));
                  } catch (e) {
                    alert(e.message);
                  }
                }}
                data-testid="view-predictions-btn"
              >
                <Trophy className="w-4 h-4" />
                View User Predictions ({userDetail.predictions_count || 0})
              </Button>
              
              {/* Predictions List */}
              {userDetail.predictions && userDetail.predictions.length > 0 && userDetail.showPredictions && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">Predictions ({userDetail.predictions.length})</p>
                    <button
                      onClick={() => setUserDetail(prev => ({ ...prev, showPredictions: false }))}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Hide
                    </button>
                  </div>
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by club name..."
                      value={userDetail.predictionSearch || ''}
                      onChange={e => setUserDetail(prev => ({ ...prev, predictionSearch: e.target.value }))}
                      className="h-8 pl-8 text-xs"
                      data-testid="prediction-search"
                    />
                  </div>
                  
                  {/* Predictions */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {userDetail.predictions
                      .filter(pred => {
                        if (!userDetail.predictionSearch) return true;
                        const search = userDetail.predictionSearch.toLowerCase();
                        const home = pred.match_data?.homeTeam?.name?.toLowerCase() || '';
                        const away = pred.match_data?.awayTeam?.name?.toLowerCase() || '';
                        return home.includes(search) || away.includes(search);
                      })
                      .map(pred => (
                      <div key={pred.prediction_id} className="p-3 rounded-lg border border-border bg-card hover:bg-card/80 transition-colors">
                        {/* Match Info */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {pred.match_data?.homeTeam?.crest && (
                              <img src={pred.match_data.homeTeam.crest} alt="" className="w-5 h-5 object-contain" />
                            )}
                            <span className="text-xs font-semibold text-foreground truncate">
                              {pred.match_data?.homeTeam?.name || 'Unknown'}
                            </span>
                            <span className="text-xs text-muted-foreground">vs</span>
                            {pred.match_data?.awayTeam?.crest && (
                              <img src={pred.match_data.awayTeam.crest} alt="" className="w-5 h-5 object-contain" />
                            )}
                            <span className="text-xs font-semibold text-foreground truncate">
                              {pred.match_data?.awayTeam?.name || 'Unknown'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            pred.result === 'correct' ? 'bg-emerald-500/20 text-emerald-500' :
                            pred.result === 'wrong' ? 'bg-red-500/20 text-red-500' :
                            'bg-amber-500/20 text-amber-500'
                          }`}>
                            {pred.result === 'correct' ? '✓ Correct' : pred.result === 'wrong' ? '✗ Wrong' : 'Pending'}
                          </span>
                        </div>
                        
                        {/* Prediction & Points */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Predicted: <span className="text-foreground font-semibold">{pred.prediction === 'home' ? 'Home Win' : pred.prediction === 'away' ? 'Away Win' : 'Draw'}</span>
                          </span>
                          {pred.points_value !== undefined && (
                            <span className={`font-bold ${pred.points_value > 0 ? 'text-emerald-500' : pred.points_value < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {pred.points_value > 0 ? '+' : ''}{pred.points_value} pts
                            </span>
                          )}
                        </div>
                        
                        {/* Date */}
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {new Date(pred.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ============ MATCHES TAB ============ */
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
    try { await api('/matches/refresh', { method: 'POST' }); fetchMatches(); }
    catch (e) { alert(e.message); }
    finally { setRefreshing(false); }
  };

  const togglePin = async (id) => {
    try { await api(`/matches/${id}/pin`, { method: 'POST' }); fetchMatches(); }
    catch (e) { alert(e.message); }
  };

  const hideMatch = async (id) => {
    try { await api(`/matches/${id}`, { method: 'DELETE' }); fetchMatches(); }
    catch (e) { alert(e.message); }
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
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${m.status === 'LIVE' ? 'bg-red-500/20 text-red-400' : m.status === 'FINISHED' ? 'bg-zinc-500/20 text-zinc-400' : 'bg-sky-500/15 text-sky-400'}`}>{m.status === 'LIVE' ? 'LIVE' : m.status === 'FINISHED' ? 'FT' : m.status}</span>
                  {m.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium truncate">{m.homeTeam?.name}</span>
                  {m.score && m.score.home !== null && <span className="font-bold tabular-nums text-foreground">{m.score.home} - {m.score.away}</span>}
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

/* ============ POINTS SETTINGS TAB ============ */
const PointsTab = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    correct_prediction: 10,
    wrong_penalty: 5,
    penalty_min_level: 5,
    exact_score_bonus: 50,
    level_thresholds: [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
  });

  useEffect(() => {
    api('/points-config')
      .then(data => {
        setConfig(data);
        setFormData({
          correct_prediction: data.correct_prediction || 10,
          wrong_penalty: data.wrong_penalty || 5,
          penalty_min_level: data.penalty_min_level || 5,
          exact_score_bonus: data.exact_score_bonus || 50,
          level_thresholds: data.level_thresholds || [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api('/points-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setConfig(response.config);
      alert('Points configuration saved successfully!');
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all points settings to defaults?')) return;
    setSaving(true);
    try {
      const response = await api('/points-config/reset', { method: 'POST' });
      setConfig(response.config);
      setFormData({
        correct_prediction: response.config.correct_prediction,
        wrong_penalty: response.config.wrong_penalty,
        penalty_min_level: response.config.penalty_min_level,
        exact_score_bonus: response.config.exact_score_bonus,
        level_thresholds: response.config.level_thresholds
      });
      alert('Points configuration reset to defaults!');
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateThreshold = (index, value) => {
    const newThresholds = [...formData.level_thresholds];
    newThresholds[index] = Math.max(0, parseInt(value) || 0);
    setFormData({ ...formData, level_thresholds: newThresholds });
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="admin-points">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Points Configuration</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Configure points for correct predictions, penalties, and exact score bonuses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="gap-1.5" data-testid="reset-points-btn">
            <RotateCcw className="w-3.5 h-3.5" />Reset to Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" data-testid="save-points-btn">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Correct Prediction Points */}
        <div className="p-4 rounded-xl border border-border/40 bg-card/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Correct Prediction</p>
              <p className="text-[10px] text-muted-foreground">Points awarded for correct predictions</p>
            </div>
          </div>
          <Input
            type="number"
            min="0"
            max="1000"
            value={formData.correct_prediction}
            onChange={e => setFormData({ ...formData, correct_prediction: Math.max(0, Math.min(1000, parseInt(e.target.value) || 0)) })}
            className="h-10 text-lg font-bold text-center"
            data-testid="correct-prediction-input"
          />
        </div>

        {/* Wrong Prediction Penalty */}
        <div className="p-4 rounded-xl border border-border/40 bg-card/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 text-red-500 flex items-center justify-center">
              <X className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Wrong Prediction Penalty</p>
              <p className="text-[10px] text-muted-foreground">Points deducted (applied at level {formData.penalty_min_level}+)</p>
            </div>
          </div>
          <Input
            type="number"
            min="0"
            max="100"
            value={formData.wrong_penalty}
            onChange={e => setFormData({ ...formData, wrong_penalty: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
            className="h-10 text-lg font-bold text-center"
            data-testid="wrong-penalty-input"
          />
        </div>

        {/* Exact Score Bonus */}
        <div className="p-4 rounded-xl border border-border/40 bg-card/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Exact Score Bonus</p>
              <p className="text-[10px] text-muted-foreground">Bonus points for predicting exact score</p>
            </div>
          </div>
          <Input
            type="number"
            min="0"
            max="500"
            value={formData.exact_score_bonus}
            onChange={e => setFormData({ ...formData, exact_score_bonus: Math.max(0, Math.min(500, parseInt(e.target.value) || 0)) })}
            className="h-10 text-lg font-bold text-center"
            data-testid="exact-bonus-input"
          />
        </div>

        {/* Penalty Minimum Level */}
        <div className="p-4 rounded-xl border border-border/40 bg-card/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-500 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Penalty Minimum Level</p>
              <p className="text-[10px] text-muted-foreground">Level at which wrong prediction penalty applies</p>
            </div>
          </div>
          <Input
            type="number"
            min="0"
            max="10"
            value={formData.penalty_min_level}
            onChange={e => setFormData({ ...formData, penalty_min_level: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)) })}
            className="h-10 text-lg font-bold text-center"
            data-testid="penalty-level-input"
          />
        </div>
      </div>

      {/* Level Thresholds */}
      <div className="p-4 rounded-xl border border-border/40 bg-card/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Level Thresholds</p>
            <p className="text-[10px] text-muted-foreground">Points required to reach each level (0-10)</p>
          </div>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
          {formData.level_thresholds.map((threshold, index) => (
            <div key={index} className="text-center">
              <label className="text-[10px] text-muted-foreground font-medium block mb-1">Lvl {index}</label>
              <Input
                type="number"
                min="0"
                value={threshold}
                onChange={e => updateThreshold(index, e.target.value)}
                className="h-9 text-xs text-center px-1"
                data-testid={`level-threshold-${index}`}
              />
            </div>
          ))}
        </div>
        
        <p className="text-[10px] text-muted-foreground mt-3">
          Note: Level thresholds must be in increasing order. Level 0 should always be 0.
        </p>
      </div>

      {/* Last Updated Info */}
      {config?.updated_at && (
        <p className="text-[10px] text-muted-foreground text-right">
          Last updated: {new Date(config.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
};

/* ============ SYSTEM TAB (API Management) ============ */


/* ============ BANNERS TAB ============ */
const BannersTab = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editBanner, setEditBanner] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    button_text: '',
    button_link: '',
    order: 0,
    is_active: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchBanners = useCallback(() => {
    setLoading(true);
    api('/banners').then(d => setBanners(d.banners || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, WebP, and GIF images are allowed');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large (max 5MB)');
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      alert('Title is required');
      return;
    }

    if (!editBanner && !imageFile) {
      alert('Image is required');
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append('title', formData.title);
      form.append('subtitle', formData.subtitle);
      form.append('button_text', formData.button_text);
      form.append('button_link', formData.button_link);
      form.append('order', formData.order);
      form.append('is_active', formData.is_active);
      
      if (imageFile) {
        form.append('image', imageFile);
      }

      const url = editBanner ? `/banners/${editBanner.banner_id}` : '/banners';
      const method = editBanner ? 'PUT' : 'POST';

      const response = await fetch(`${API_URL}/api/admin${url}`, {
        method,
        credentials: 'include',
        body: form
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Error ${response.status}`);
      }

      setShowAdd(false);
      setEditBanner(null);
      setFormData({ title: '', subtitle: '', button_text: '', button_link: '', order: 0, is_active: true });
      setImageFile(null);
      setImagePreview('');
      fetchBanners();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (banner) => {
    setEditBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      button_text: banner.button_text || '',
      button_link: banner.button_link || '',
      order: banner.order || 0,
      is_active: banner.is_active
    });
    setImagePreview(banner.image_url?.startsWith('/') ? `${API_URL}${banner.image_url}` : banner.image_url);
    setShowAdd(true);
  };

  const handleDelete = async (banner_id) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await api(`/banners/${banner_id}`, { method: 'DELETE' });
      fetchBanners();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleActive = async (banner_id) => {
    try {
      await api(`/banners/${banner_id}/toggle`, { method: 'POST' });
      fetchBanners();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300" data-testid="admin-banners">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Carousel Banners</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Manage homepage carousel banners. Upload images, set order, enable/disable.</p>
        </div>
        <Button size="sm" onClick={() => {
          setShowAdd(true);
          setEditBanner(null);
          setFormData({ title: '', subtitle: '', button_text: '', button_link: '', order: 0, is_active: true });
          setImagePreview('');
          setImageFile(null);
        }} className="gap-1.5" data-testid="add-banner-btn">
          <Plus className="w-3.5 h-3.5" />Add Banner
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {banners.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No banners yet. Add your first banner!</p>
          ) : banners.map(b => (
            <div key={b.banner_id} className={`rounded-xl border p-4 transition-colors ${b.is_active ? 'border-primary/50 bg-primary/5' : 'border-border/20 bg-card/30 opacity-60'}`} data-testid={`banner-card-${b.banner_id}`}>
              <div className="flex items-start gap-4">
                {/* Image Preview */}
                <div className="shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-secondary">
                  <img 
                    src={b.image_url?.startsWith('/') ? `${API_URL}${b.image_url}` : b.image_url} 
                    alt={b.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Banner Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{b.title}</span>
                    {b.is_active && <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold">ACTIVE</span>}
                    {!b.is_active && <span className="px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 text-[9px] font-bold">DISABLED</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{b.subtitle || 'No subtitle'}</p>
                  {b.button_text && <p className="text-[10px] text-primary mt-1">Button: {b.button_text}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">Order: {b.order}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={() => toggleActive(b.banner_id)} 
                    className={`p-1.5 rounded-lg transition-colors ${b.is_active ? 'hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500' : 'hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500'}`} 
                    title={b.is_active ? 'Disable' : 'Enable'}
                  >
                    {b.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </button>
                  <button 
                    onClick={() => handleEdit(b)} 
                    className="p-1.5 rounded-lg hover:bg-sky-500/10 text-muted-foreground hover:text-sky-500 transition-colors" 
                    title="Edit"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(b.banner_id)} 
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" 
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Banner Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => {
        if (!open) {
          setShowAdd(false);
          setEditBanner(null);
          setImageFile(null);
          setImagePreview('');
        }
      }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editBanner ? 'Edit Banner' : 'Add New Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Image Upload */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Banner Image *</label>
              <div className="space-y-2">
                {imagePreview && (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden bg-secondary">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageSelect}
                  className="h-9 text-sm" 
                  data-testid="banner-image-input" 
                />
                <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP, or GIF (max 5MB)</p>
              </div>
            </div>
            
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Title *</label>
              <Input 
                value={formData.title} 
                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} 
                placeholder="e.g. Welcome to GuessIt" 
                className="h-9 text-sm" 
                data-testid="banner-title-input" 
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Subtitle</label>
              <Input 
                value={formData.subtitle} 
                onChange={e => setFormData(p => ({ ...p, subtitle: e.target.value }))} 
                placeholder="e.g. Predict. Compete. Win." 
                className="h-9 text-sm" 
                data-testid="banner-subtitle-input" 
              />
            </div>

            {/* Button Text */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Button Text</label>
              <Input 
                value={formData.button_text} 
                onChange={e => setFormData(p => ({ ...p, button_text: e.target.value }))} 
                placeholder="e.g. Get Started" 
                className="h-9 text-sm" 
                data-testid="banner-btn-text-input" 
              />
            </div>

            {/* Button Link */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Button Link</label>
              <Input 
                value={formData.button_link} 
                onChange={e => setFormData(p => ({ ...p, button_link: e.target.value }))} 
                placeholder="/register or https://..." 
                className="h-9 text-sm" 
                data-testid="banner-btn-link-input" 
              />
            </div>

            {/* Order */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Display Order</label>
              <Input 
                type="number"
                value={formData.order} 
                onChange={e => setFormData(p => ({ ...p, order: parseInt(e.target.value) || 0 }))} 
                className="h-9 text-sm" 
                data-testid="banner-order-input" 
              />
              <p className="text-[10px] text-muted-foreground mt-1">Lower numbers appear first</p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="banner-active"
                checked={formData.is_active}
                onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="banner-active" className="text-xs font-semibold text-foreground">Active (visible on homepage)</label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving} data-testid="save-banner-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editBanner ? 'Update' : 'Add Banner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


const SystemTab = () => {
  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newApi, setNewApi] = useState({ name: '', base_url: '', api_key: '' });
  const [adding, setAdding] = useState(false);

  const fetchApis = useCallback(() => {
    setLoading(true);
    api('/system/apis').then(d => setApis(d.apis || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchApis(); }, [fetchApis]);

  const addApi = async () => {
    if (!newApi.name || !newApi.base_url) { alert('Name and URL required'); return; }
    setAdding(true);
    try {
      await api('/system/apis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newApi) });
      setShowAdd(false);
      setNewApi({ name: '', base_url: '', api_key: '' });
      fetchApis();
    } catch (e) { alert(e.message); }
    finally { setAdding(false); }
  };

  const toggleApi = async (apiId) => {
    try { await api(`/system/apis/${apiId}/toggle`, { method: 'POST' }); fetchApis(); }
    catch (e) { alert(e.message); }
  };

  const activateApi = async (apiId) => {
    try { await api(`/system/apis/${apiId}/activate`, { method: 'POST' }); fetchApis(); }
    catch (e) { alert(e.message); }
  };

  const deleteApi = async (apiId) => {
    if (!window.confirm('Delete this API configuration?')) return;
    try { await api(`/system/apis/${apiId}`, { method: 'DELETE' }); fetchApis(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300" data-testid="admin-system">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Football Data APIs</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Manage and switch between football data providers. No data is lost when switching.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5" data-testid="add-api-btn">
          <Plus className="w-3.5 h-3.5" />Add API
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {apis.map(a => (
            <div key={a.api_id} className={`rounded-xl border p-4 transition-colors ${a.is_active ? 'border-primary/50 bg-primary/5' : a.enabled ? 'border-border/40 bg-card/60' : 'border-border/20 bg-card/30 opacity-60'}`} data-testid={`api-card-${a.api_id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.is_active ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    <Server className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{a.name}</span>
                      {a.is_active && <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold">ACTIVE</span>}
                      {!a.enabled && <span className="px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 text-[9px] font-bold">DISABLED</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{a.base_url}</p>
                    {a.api_key && <p className="text-[10px] text-muted-foreground">Key: {a.api_key_masked ? a.api_key : '***'}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!a.is_default && (
                    <>
                      <button onClick={() => toggleApi(a.api_id)} className={`p-1.5 rounded-lg transition-colors ${a.enabled ? 'hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500' : 'hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500'}`} title={a.enabled ? 'Disable' : 'Enable'}>
                        {a.enabled ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      {!a.is_active && a.enabled && (
                        <button onClick={() => activateApi(a.api_id)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Set as Active">
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!a.is_active && (
                        <button onClick={() => deleteApi(a.api_id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add API Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Add Football Data API</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-foreground mb-1 block">Name</label><Input value={newApi.name} onChange={e => setNewApi(p => ({ ...p, name: e.target.value }))} placeholder="e.g. API-Football" className="h-9 text-sm" data-testid="api-name-input" /></div>
            <div><label className="text-xs font-semibold text-foreground mb-1 block">Base URL</label><Input value={newApi.base_url} onChange={e => setNewApi(p => ({ ...p, base_url: e.target.value }))} placeholder="https://api.example.com/v4" className="h-9 text-sm" data-testid="api-url-input" /></div>
            <div><label className="text-xs font-semibold text-foreground mb-1 block">API Key</label><Input type="password" value={newApi.api_key} onChange={e => setNewApi(p => ({ ...p, api_key: e.target.value }))} placeholder="Your API key" className="h-9 text-sm" data-testid="api-key-input" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={addApi} disabled={adding} data-testid="save-api-btn">{adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add API'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ============ PREDICTION MONITOR TAB ============ */
const StreaksTab = () => {
  const [streaks, setStreaks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minStreak, setMinStreak] = useState(10);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setLoading(true);
    api(`/prediction-streaks?min_streak=${minStreak}`).then(d => setStreaks(d.streaks || [])).catch(console.error).finally(() => setLoading(false));
  }, [minStreak]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300" data-testid="admin-streaks">
      <div>
        <h2 className="text-sm font-bold text-foreground">Prediction Streak Monitor</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Users with {minStreak}+ consecutive correct predictions. Monitor patterns and trends.</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground">Min streak:</label>
        <select value={minStreak} onChange={e => setMinStreak(Number(e.target.value))} className="h-8 px-2 rounded-lg border border-border bg-secondary/50 text-xs text-foreground" data-testid="min-streak-select">
          <option value={5}>5+</option>
          <option value={10}>10+</option>
          <option value={15}>15+</option>
          <option value={20}>20+</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : streaks.length === 0 ? (
        <div className="text-center py-16">
          <Flame className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No users with {minStreak}+ correct streak found</p>
          <p className="text-[10px] text-muted-foreground/60">Try lowering the minimum streak threshold</p>
        </div>
      ) : (
        <div className="space-y-3">
          {streaks.map((s, i) => (
            <div key={s.user.user_id} className="rounded-xl border border-border/40 bg-card/60 overflow-hidden" data-testid={`streak-${s.user.user_id}`}>
              <button onClick={() => setExpanded(expanded === s.user.user_id ? null : s.user.user_id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-zinc-400/20 text-zinc-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-secondary text-muted-foreground'}`}>#{i + 1}</span>
                <Avatar className="w-8 h-8">
                  <AvatarImage src={s.user.picture?.startsWith('/') ? `${API_URL}${s.user.picture}` : s.user.picture} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{(s.user.nickname || '?')[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{s.user.nickname}</p>
                  <p className="text-[10px] text-muted-foreground">{s.user.points} pts | Lvl {s.user.level}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-sm font-bold text-emerald-500">{s.current_streak}</p>
                    <p className="text-[9px] text-muted-foreground">Current</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-amber-500">{s.best_streak}</p>
                    <p className="text-[9px] text-muted-foreground">Best</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === s.user.user_id ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {expanded === s.user.user_id && s.upcoming_predictions.length > 0 && (
                <div className="px-4 pb-3 border-t border-border/20 pt-2">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-2">Upcoming Predictions by this user:</p>
                  <div className="space-y-1.5">
                    {s.upcoming_predictions.map((up, j) => (
                      <div key={j} className="flex items-center gap-2 text-[10px] px-2 py-1.5 bg-secondary/30 rounded-lg">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${up.prediction === 'home' ? 'bg-emerald-500/15 text-emerald-400' : up.prediction === 'away' ? 'bg-sky-500/15 text-sky-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {up.prediction === 'home' ? '1' : up.prediction === 'away' ? '2' : 'X'}
                        </span>
                        {up.match ? (
                          <span className="text-foreground">{up.match.homeTeam} vs {up.match.awayTeam} <span className="text-muted-foreground">({up.match.competition})</span></span>
                        ) : (
                          <span className="text-muted-foreground">Match #{up.match_id}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============ FAVORITES TAB ============ */
const FavoritesTab = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const fetchFavorites = useCallback(() => {
    setLoading(true);
    api('/favorite-users').then(d => setFavorites(d.favorites || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const searchForUser = async () => {
    if (searchUser.length < 2) return;
    setSearching(true);
    try {
      const data = await api(`/users?search=${encodeURIComponent(searchUser)}&limit=10`);
      setSearchResults(data.users || []);
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  };

  useEffect(() => {
    if (searchUser.length >= 2) {
      const t = setTimeout(searchForUser, 300);
      return () => clearTimeout(t);
    } else {
      setSearchResults([]);
    }
  }, [searchUser]);

  const addFavorite = async (userId) => {
    try {
      await api(`/favorite-users/${userId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      fetchFavorites();
      setAddDialog(false);
      setSearchUser('');
    } catch (e) { alert(e.message); }
  };

  const removeFavorite = async (userId) => {
    try { await api(`/favorite-users/${userId}`, { method: 'DELETE' }); fetchFavorites(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300" data-testid="admin-favorites">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Favorite Users</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Quickly access and monitor users you're tracking</p>
        </div>
        <Button size="sm" onClick={() => setAddDialog(true)} className="gap-1.5" data-testid="add-favorite-btn">
          <Plus className="w-3.5 h-3.5" />Add User
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No favorite users yet</p>
          <p className="text-[10px] text-muted-foreground/60">Add users to quickly monitor their activity</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {favorites.map(f => (
            <div key={f.user_id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-card/60 hover:border-border/70 transition-colors" data-testid={`fav-${f.user_id}`}>
              <Avatar className="w-10 h-10">
                <AvatarImage src={f.picture?.startsWith('/') ? `${API_URL}${f.picture}` : f.picture} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{(f.nickname || 'U')[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{f.nickname || f.email}</span>
                  {f.is_online && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  {f.is_banned && <span className="px-1 py-0.5 rounded bg-red-500/15 text-red-400 text-[8px] font-bold">BANNED</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">{f.points || 0} pts | Lvl {f.level || 0}</p>
                {f.last_seen && <p className="text-[9px] text-muted-foreground/60">Last seen: {new Date(f.last_seen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
              </div>
              <button onClick={() => removeFavorite(f.user_id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Remove from favorites">
                <StarOff className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Favorite Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Add Favorite User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder="Search by nickname or email..." className="h-9 text-sm" data-testid="fav-search-input" />
            <div className="max-h-48 overflow-y-auto divide-y divide-border/20 border border-border/30 rounded-lg">
              {searching && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>}
              {!searching && searchResults.length === 0 && searchUser.length >= 2 && (
                <p className="text-center text-muted-foreground text-xs py-4">No users found</p>
              )}
              {searchResults.map(u => (
                <button key={u.user_id} onClick={() => addFavorite(u.user_id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/20 text-left">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={u.picture?.startsWith('/') ? `${API_URL}${u.picture}` : u.picture} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[8px]">{(u.nickname || 'U')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">{u.nickname || 'No nickname'}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{u.email}</span>
                  </div>
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ============ NOTIFICATIONS TAB ============ */
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
        const r = await api('/notifications/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
        setResult({ ok: true, msg: `Sent to ${r.sent_to} users` });
      } else {
        if (!userId.trim()) { alert('User ID required'); setSending(false); return; }
        await api('/notifications/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, message }) });
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
          <label className="text-xs font-semibold text-foreground mb-1.5 block">{mode === 'broadcast' ? 'Broadcast Message' : 'Notification Message'}</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your notification..." className="w-full h-24 px-3 py-2 rounded-xl border border-border/40 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 resize-none" maxLength={500} data-testid="notif-message" />
        </div>
        <Button onClick={send} disabled={sending || !message.trim()} className="gap-2" data-testid="send-notification-btn">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {mode === 'broadcast' ? 'Send to All Users' : 'Send Notification'}
        </Button>
        {result && <p className={`text-xs font-medium ${result.ok ? 'text-emerald-500' : 'text-red-500'}`}>{result.msg}</p>}
      </div>
    </div>
  );
};

/* ============ ANALYTICS TAB ============ */
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
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Top Predictors</p>
        {data.top_predictors.length === 0 ? (
          <p className="text-xs text-muted-foreground">No prediction data yet</p>
        ) : (
          <div className="space-y-2">
            {data.top_predictors.map((p, i) => (
              <div key={p.user_id} className="flex items-center gap-3 text-xs">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-zinc-400/20 text-zinc-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-secondary text-muted-foreground'}`}>{i + 1}</span>
                <span className="flex-1 font-medium text-foreground">{p.nickname}</span>
                <span className="text-muted-foreground">{p.count} predictions</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Points Distribution</p>
        <div className="flex items-end gap-3 h-24">
          {data.points_distribution.map((p) => {
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

/* ============ SUBSCRIPTIONS TAB ============ */
const SubscriptionsTab = () => {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/subscriptions?page=${page}&limit=20`);
      setSubs(data.subscriptions || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const handleDelete = async (subId) => {
    if (!window.confirm('Delete this subscription?')) return;
    try {
      await api(`/subscriptions/${subId}`, { method: 'DELETE' });
      fetchSubs();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4" data-testid="subscriptions-tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{total}</span></p>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : subs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No subscriptions yet</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.sub_id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-4 py-3 text-foreground">{s.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(s.subscribed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(s.sub_id)} className="text-red-400 hover:text-red-300 transition-colors" data-testid={`delete-sub-${s.sub_id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 hover:bg-secondary disabled:opacity-30"><ChevronLeft className="w-3 h-3" /></button>
          <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 hover:bg-secondary disabled:opacity-30"><ChevronRight className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  );
};

/* ============ CONTACT MESSAGES TAB ============ */
const ContactMessagesTab = () => {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [pages, setPages] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const fetchMsgs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/contact-messages?page=${page}&limit=20`);
      setMsgs(data.messages || []);
      setTotal(data.total || 0);
      setUnread(data.unread || 0);
      setPages(data.pages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchMsgs(); }, [fetchMsgs]);

  const toggleFlag = async (msgId) => {
    try {
      await api(`/contact-messages/${msgId}/flag`, { method: 'PUT' });
      fetchMsgs();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api(`/contact-messages/${msgId}`, { method: 'DELETE' });
      fetchMsgs();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4" data-testid="contact-messages-tab">
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{total}</span></p>
        {unread > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">{unread} unread</span>}
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : msgs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No contact messages yet</p>
      ) : (
        <div className="space-y-3">
          {msgs.map(m => (
            <div key={m.msg_id} className={`rounded-xl border ${m.flagged ? 'border-amber-500/50 bg-amber-500/5' : 'border-border bg-card/60'} p-4`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 cursor-pointer" onClick={() => setExpanded(expanded === m.msg_id ? null : m.msg_id)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground text-sm">{m.name}</span>
                    <span className="text-xs text-muted-foreground">&lt;{m.email}&gt;</span>
                    {!m.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm font-medium text-foreground">{m.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(m.submitted_at).toLocaleString()}</p>
                  {expanded === m.msg_id && (
                    <div className="mt-3 p-3 rounded-lg bg-secondary/30 text-sm text-foreground whitespace-pre-wrap">{m.message}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleFlag(m.msg_id)} className={`p-1.5 rounded-lg transition-colors ${m.flagged ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground hover:text-amber-500'}`} title="Flag" data-testid={`flag-msg-${m.msg_id}`}>
                    <Pin className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(m.msg_id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 transition-colors" data-testid={`delete-msg-${m.msg_id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 hover:bg-secondary disabled:opacity-30"><ChevronLeft className="w-3 h-3" /></button>
          <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 hover:bg-secondary disabled:opacity-30"><ChevronRight className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  );
};

/* ============ CONTACT SETTINGS TAB ============ */
const ContactSettingsTab = () => {
  const [settings, setSettings] = useState({ email_title: '', email_address: '', location_title: '', location_address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const data = await api('/contact-settings');
        setSettings(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch_();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api('/contact-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-lg space-y-6" data-testid="contact-settings-tab">
      <p className="text-sm text-muted-foreground">Edit the contact information shown on the Contact page.</p>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Email Section Title</label>
          <Input value={settings.email_title} onChange={e => setSettings(s => ({ ...s, email_title: e.target.value }))} data-testid="cs-email-title" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Support Email Address</label>
          <Input value={settings.email_address} onChange={e => setSettings(s => ({ ...s, email_address: e.target.value }))} data-testid="cs-email-address" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Location Title</label>
          <Input value={settings.location_title} onChange={e => setSettings(s => ({ ...s, location_title: e.target.value }))} data-testid="cs-location-title" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Location Address</label>
          <Input value={settings.location_address} onChange={e => setSettings(s => ({ ...s, location_address: e.target.value }))} data-testid="cs-location-address" />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving} className="gap-2" data-testid="cs-save-btn">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
};

/* ============ NEWS MANAGEMENT TAB ============ */
const NewsTab = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editArticle, setEditArticle] = useState(null);
  const [form, setForm] = useState({ title: '', date: '', category: 'News', published: true });
  const [blocks, setBlocks] = useState([]);
  const [coverImage, setCoverImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/news?limit=50');
      setArticles(data.articles || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const resetForm = () => {
    setForm({ title: '', date: new Date().toISOString().slice(0, 10), category: 'News', published: true });
    setBlocks([]);
    setCoverImage(null);
    setEditArticle(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setEditArticle(null);
    setForm({ title: '', date: new Date().toISOString().slice(0, 10), category: 'News', published: true });
    setBlocks([{ type: 'text', value: '' }]);
    setCoverImage(null);
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditArticle(a);
    setForm({ title: a.title, date: a.date || '', category: a.category || 'News', published: a.published !== false });
    const existingBlocks = a.content_blocks && a.content_blocks.length > 0
      ? a.content_blocks
      : a.content ? [{ type: 'text', value: a.content }] : [{ type: 'text', value: '' }];
    setBlocks(existingBlocks);
    setCoverImage(null);
    setShowForm(true);
  };

  const addTextBlock = () => setBlocks(b => [...b, { type: 'text', value: '' }]);

  const handleImageUpload = async (file, idx) => {
    setUploadingIdx(idx);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const data = await api('/news/upload-image', { method: 'POST', body: fd });
      if (data.url) {
        setBlocks(prev => {
          const copy = [...prev];
          copy[idx] = { type: 'image', url: data.url };
          return copy;
        });
      }
    } catch (err) { alert('Image upload failed: ' + err.message); }
    finally { setUploadingIdx(null); }
  };

  const addImageBlock = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const newIdx = blocks.length;
        setBlocks(b => [...b, { type: 'image', url: '', uploading: true }]);
        handleImageUpload(file, newIdx);
      }
    };
    input.click();
  };

  const updateBlockText = (idx, value) => {
    setBlocks(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], value };
      return copy;
    });
  };

  const removeBlock = (idx) => setBlocks(prev => prev.filter((_, i) => i !== idx));

  const moveBlock = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    setBlocks(prev => {
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { alert('Title is required'); return; }
    setSaving(true);
    try {
      const cleanBlocks = blocks.filter(b => (b.type === 'text' && b.value.trim()) || (b.type === 'image' && b.url));
      const plainContent = cleanBlocks.filter(b => b.type === 'text').map(b => b.value).join('\n\n');
      
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('content', plainContent);
      fd.append('content_blocks', JSON.stringify(cleanBlocks));
      fd.append('date', form.date);
      fd.append('category', form.category);
      fd.append('published', form.published.toString());
      if (coverImage) fd.append('image', coverImage);

      const url = editArticle ? `/news/${editArticle.article_id}` : '/news';
      const method = editArticle ? 'PUT' : 'POST';
      await api(url, { method, body: fd });
      resetForm();
      fetchNews();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (articleId) => {
    if (!window.confirm('Delete this article?')) return;
    try {
      await api(`/news/${articleId}`, { method: 'DELETE' });
      fetchNews();
    } catch (err) { alert(err.message); }
  };

  const togglePublish = async (articleId) => {
    try {
      await api(`/news/${articleId}/toggle`, { method: 'PUT' });
      fetchNews();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4" data-testid="news-tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage news articles</p>
        <Button size="sm" onClick={openCreate} className="gap-1.5" data-testid="create-news-btn">
          <Plus className="w-4 h-4" /> New Article
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
          <h3 className="font-bold text-foreground">{editArticle ? 'Edit Article' : 'New Article'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Title *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="news-title-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Date</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} data-testid="news-date-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Category</label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="News, Feature, Update..." data-testid="news-category-input" />
            </div>
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Cover Image (optional)</label>
            <input type="file" accept="image/*" onChange={e => setCoverImage(e.target.files[0])} className="text-sm text-muted-foreground" data-testid="news-cover-input" />
          </div>

          {/* Content Blocks */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Content Blocks</label>
            <div className="space-y-3">
              {blocks.map((block, idx) => (
                <div key={idx} className="relative group rounded-lg border border-border/50 bg-background p-3">
                  {/* Block controls */}
                  <div className="absolute -top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">&uarr;</button>
                    <button onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">&darr;</button>
                    <button onClick={() => removeBlock(idx)} className="w-6 h-6 rounded bg-red-500/10 flex items-center justify-center text-xs text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                  </div>

                  {block.type === 'text' ? (
                    <textarea
                      value={block.value}
                      onChange={e => updateBlockText(idx, e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 text-sm rounded-lg border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none resize-y"
                      placeholder="Write text content..."
                    />
                  ) : (
                    <div className="flex items-center justify-center min-h-[80px]">
                      {uploadingIdx === idx || (!block.url && block.uploading) ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                        </div>
                      ) : block.url ? (
                        <img 
                          src={block.url.startsWith('/') ? `${API_URL}${block.url}` : block.url} 
                          alt="" 
                          className="max-h-48 rounded-lg object-contain" 
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">Image failed to upload</span>
                      )}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground/50 mt-1">{block.type === 'text' ? 'Text Block' : 'Image Block'}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={addTextBlock} className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" data-testid="add-text-block">
                <Plus className="w-3 h-3" /> Text Block
              </button>
              <button onClick={addImageBlock} className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" data-testid="add-image-block">
                <Plus className="w-3 h-3" /> Image Block
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} className="accent-primary" />
              <span className="text-foreground">Published</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5" data-testid="news-save-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editArticle ? 'Update' : 'Create'}
            </Button>
            <Button onClick={resetForm} variant="outline" size="sm">Cancel</Button>
          </div>
        </div>
      )}

      {/* Article List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : articles.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No news articles yet</p>
      ) : (
        <div className="space-y-3">
          {articles.map(a => (
            <div key={a.article_id} className="flex items-center gap-4 rounded-xl border border-border bg-card/60 p-4 hover:border-border/70 transition-colors">
              {a.image_url && (
                <img src={a.image_url.startsWith('/') ? `${API_URL}${a.image_url}` : a.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-foreground text-sm truncate">{a.title}</h4>
                  {!a.published && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-semibold">Draft</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.date} &middot; {a.category} &middot; {(a.content_blocks || []).length} blocks</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => togglePublish(a.article_id)} className={`p-1.5 rounded-lg transition-colors ${a.published ? 'text-emerald-500' : 'text-muted-foreground hover:text-emerald-500'}`} title={a.published ? 'Unpublish' : 'Publish'}>
                  {a.published ? <Eye className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors" data-testid={`edit-news-${a.article_id}`}>
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(a.article_id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 transition-colors" data-testid={`delete-news-${a.article_id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============ MAIN ADMIN PAGE ============ */
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
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <X className="w-8 h-8 text-red-500/40" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Page Not Found</h1>
        <p className="text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
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
            <Server className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Control Panel</span>
          </div>
          <div className="flex-1 py-2 space-y-0.5 overflow-y-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 md:px-5 py-2.5 text-xs font-medium transition-all duration-150 ${
                  activeTab === t.id ? 'text-primary bg-primary/[0.08] border-r-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                }`}
                data-testid={`admin-tab-${t.id}`}>
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
              <h1 className="text-lg font-bold text-foreground capitalize">{TABS.find(t => t.id === activeTab)?.label || activeTab}</h1>
              <span className="text-[10px] text-muted-foreground hidden md:block">Logged in as {user?.nickname || user?.email}</span>
            </div>

            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'matches' && <MatchesTab />}
            {activeTab === 'points' && <PointsTab />}
            {activeTab === 'system' && <SystemTab />}
            {activeTab === 'banners' && <BannersTab />}
            {activeTab === 'news' && <NewsTab />}
            {activeTab === 'subscriptions' && <SubscriptionsTab />}
            {activeTab === 'contact-msgs' && <ContactMessagesTab />}
            {activeTab === 'contact-settings' && <ContactSettingsTab />}
            {activeTab === 'streaks' && <StreaksTab />}
            {activeTab === 'favorites' && <FavoritesTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
