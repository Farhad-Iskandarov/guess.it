import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessages } from '@/lib/MessagesContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/messages';
import { Button } from '@/components/ui/button';
import {
  Bell, Check, CheckCheck, UserPlus, UserCheck, MessageSquare, Trophy, Loader2, X
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============ Notification Icon by Type ============
const NotifIcon = memo(({ type }) => {
  switch (type) {
    case 'friend_request':
      return <UserPlus className="w-4 h-4 text-blue-400" />;
    case 'friend_accepted':
      return <UserCheck className="w-4 h-4 text-emerald-400" />;
    case 'new_message':
      return <MessageSquare className="w-4 h-4 text-primary" />;
    case 'badge_earned':
      return <Trophy className="w-4 h-4 text-amber-400" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
});
NotifIcon.displayName = 'NotifIcon';

// ============ Time Ago ============
function timeAgo(dateString) {
  const d = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ============ Notification Item ============
const NotificationItem = memo(({ notif, onMarkRead, onNavigate }) => (
  <button
    onClick={() => {
      if (!notif.read) onMarkRead(notif.notification_id);
      onNavigate(notif);
    }}
    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/20 last:border-b-0 ${
      notif.read ? 'opacity-60 hover:opacity-80' : 'hover:bg-secondary/50'
    }`}
    data-testid={`notif-item-${notif.notification_id}`}
  >
    <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
      notif.read ? 'bg-muted/50' : 'bg-primary/10'
    }`}>
      <NotifIcon type={notif.type} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm ${notif.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
        {notif.message}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(notif.created_at)}</p>
    </div>
    {!notif.read && (
      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
    )}
  </button>
));
NotificationItem.displayName = 'NotificationItem';

// ============ Notification Badge ============
const NotifBadge = memo(({ count }) => {
  if (!count || count <= 0) return null;
  return (
    <span
      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground badge-pulse"
      data-testid="notification-badge"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
});
NotifBadge.displayName = 'NotifBadge';

// ============ Main Dropdown ============
export const NotificationDropdown = () => {
  const navigate = useNavigate();
  const { unreadNotifications, setUnreadNotifications, addNotifListener } = useMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef(null);

  // Load notifications when dropdown opens
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(20, 0);
      setNotifications(data.notifications || []);
      setUnreadNotifications(data.unread_count || 0);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [setUnreadNotifications]);

  // Toggle dropdown
  const toggle = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) loadNotifications();
      return !prev;
    });
  }, [loadNotifications]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Listen for real-time notifications to add to list
  useEffect(() => {
    const remove = addNotifListener((data) => {
      if (data.type === 'notification' && data.notification) {
        setNotifications(prev => [data.notification, ...prev].slice(0, 30));
      }
    });
    return remove;
  }, [addNotifListener]);

  // Mark single notification read
  const handleMarkRead = useCallback(async (notifId) => {
    try {
      await markNotificationRead(notifId);
      setNotifications(prev =>
        prev.map(n => n.notification_id === notifId ? { ...n, read: true } : n)
      );
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  }, [setUnreadNotifications]);

  // Mark all read
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadNotifications(0);
    } catch (e) {
      console.error('Failed to mark all read:', e);
    } finally {
      setMarkingAll(false);
    }
  }, [setUnreadNotifications]);

  // Navigate based on notification type
  const handleNavigate = useCallback((notif) => {
    setIsOpen(false);
    switch (notif.type) {
      case 'friend_request':
        navigate('/friends');
        break;
      case 'friend_accepted':
        navigate('/friends');
        break;
      case 'new_message':
        navigate('/messages');
        break;
      default:
        break;
    }
  }, [navigate]);

  return (
    <div className="relative" ref={dropdownRef}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              onClick={toggle}
              aria-label="Notifications"
              data-testid="header-notifications"
            >
              <Bell className="h-5 w-5" />
              <NotifBadge count={unreadNotifications} />
            </Button>
          </TooltipTrigger>
          {!isOpen && (
            <TooltipContent side="bottom" className="bg-popover text-popover-foreground">
              <p>Notifications</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Dropdown Panel — mobile-optimized */}
      {isOpen && (
        <div
          className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-[4.5rem] sm:top-full sm:mt-2 sm:w-[360px] max-h-[60vh] sm:max-h-[480px] rounded-xl bg-card border border-border shadow-xl shadow-black/30 z-[100] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
          data-testid="notification-dropdown"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadNotifications > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-xs text-primary hover:text-primary h-7 px-2"
                  data-testid="mark-all-read-btn"
                >
                  {markingAll ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCheck className="w-3 h-3 mr-1" />}
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(60vh-3.5rem)] sm:max-h-[400px] overscroll-contain scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : notifications.length > 0 ? (
              notifications.map(notif => (
                <NotificationItem
                  key={notif.notification_id}
                  notif={notif}
                  onMarkRead={handleMarkRead}
                  onNavigate={handleNavigate}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Bell className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">We'll notify you when something happens</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
