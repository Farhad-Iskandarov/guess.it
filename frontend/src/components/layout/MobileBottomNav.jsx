import { memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Trophy, Send, Bookmark, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
  { id: 'message', label: 'Message', icon: Send, path: '/messages' },
  { id: 'saved', label: 'Saved', icon: Bookmark, path: '/saved-matches' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
];

const MobileBottomNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Hide on auth pages and admin
  const hiddenPaths = ['/login', '/register', '/choose-nickname', '/itguess/admin', '/admin'];
  const shouldHide = hiddenPaths.some(p => location.pathname.startsWith(p));
  if (shouldHide) return null;

  const handleNav = (item) => {
    if (!isAuthenticated && item.id !== 'home' && item.id !== 'leaderboard') {
      navigate('/login');
      return;
    }
    if (item.path === '/' && location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(item.path);
    // Always reset scroll to top when switching tabs
    window.scrollTo(0, 0);
  };

  const isActive = (item) => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] md:hidden border-t border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0a0a0a] safe-area-bottom"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              data-testid={`bottom-nav-${item.id}`}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-150 ${
                active
                  ? 'text-zinc-900 dark:text-white'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              <Icon
                className="w-[22px] h-[22px]"
                strokeWidth={active ? 2 : 1.5}
              />
              <span className={`text-[10px] leading-tight ${active ? 'font-semibold' : 'font-normal'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

MobileBottomNav.displayName = 'MobileBottomNav';
export default MobileBottomNav;
