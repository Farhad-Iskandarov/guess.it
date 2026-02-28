import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Search, Mail, Users, Bell, Menu, Sun, Moon, LogIn, UserPlus, X, Loader2, Radio, Trophy, Zap, Newspaper, Phone, BarChart3, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from '@/lib/ThemeContext';
import { useFriends } from '@/lib/FriendsContext';
import { useMessages } from '@/lib/MessagesContext';
import { searchMatches } from '@/services/matches';
import { NotificationDropdown } from './NotificationDropdown';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// =========== Notification Badge ===========
const NotificationBadge = memo(({ count }) => {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground badge-pulse">
      {count > 99 ? '99+' : count}
    </span>
  );
});
NotificationBadge.displayName = 'NotificationBadge';

// =========== Header Icon Button ===========
const HeaderIconButton = memo(({ icon: Icon, badge, onClick, tooltip, testId }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          onClick={onClick}
          aria-label={tooltip}
          data-testid={testId}
        >
          <Icon className="h-5 w-5" />
          <NotificationBadge count={badge} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-popover text-popover-foreground">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
));
HeaderIconButton.displayName = 'HeaderIconButton';

// =========== Level Popover ===========
const LevelPopover = memo(({ userLevel, userPoints }) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-secondary border border-border hover:border-primary/40 hover:bg-secondary/80 transition-all duration-200 cursor-pointer"
        data-testid="header-level-badge"
      >
        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
        <span className="text-xs sm:text-base font-semibold text-foreground whitespace-nowrap leading-[0.5rem]">Level {userLevel}</span>
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-50 w-48 bg-popover border border-border rounded-xl shadow-xl p-4 level-popover-enter"
          data-testid="level-popover"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-base font-bold text-foreground">Level {userLevel}</span>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-semibold text-primary">{userPoints} pts</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
LevelPopover.displayName = 'LevelPopover';

// =========== User Dropdown ===========
const UserDropdownMenu = memo(({ user, onLogout }) => {
  const displayName = user?.nickname || user?.name || user?.email || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const nav = useNavigate();
  const userPoints = user?.points ?? 0;
  const userLevel = user?.level ?? 0;

  return (
    <div className="flex items-center gap-2">
      <LevelPopover userLevel={userLevel} userPoints={userPoints} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-full">
            <Avatar className="h-9 w-9 border-2 border-primary/50 cursor-pointer hover:border-primary transition-colors">
              <AvatarImage src={user?.picture} alt={displayName} />
              <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.nickname || user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-2">
            <div className="flex items-center justify-between text-xs" data-testid="dropdown-level-info">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-foreground">Level {userLevel}</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" />
                <span className="font-semibold text-primary">{userPoints} pts</span>
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" onClick={() => nav('/profile')} data-testid="nav-profile">Profile</DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => nav('/messages')} data-testid="nav-messages">Messages</DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => nav('/my-predictions')} data-testid="nav-my-predictions">My Predictions</DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => nav('/settings')} data-testid="nav-settings">Settings</DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => nav('/subscribe')} data-testid="nav-subscribe">
            <span className="flex items-center gap-2">Subscribe <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">PRO</span></span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => nav('/saved-matches')} data-testid="nav-saved-matches">
            <Bookmark className="w-4 h-4 mr-2" /> Saved Matches
          </DropdownMenuItem>
          {/* Mobile-only navigation links — visible only on screens where nav bar is hidden */}
          <DropdownMenuSeparator className="lg:hidden" />
          <DropdownMenuItem className="cursor-pointer lg:hidden" onClick={() => nav('/friends')} data-testid="nav-mobile-friends">
            <Users className="w-4 h-4 mr-2" /> Friends
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer lg:hidden" onClick={() => nav('/leaderboard')} data-testid="nav-mobile-leaderboard">
            <BarChart3 className="w-4 h-4 mr-2" /> Leaderboard
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer lg:hidden" onClick={() => nav('/news')} data-testid="nav-mobile-news">
            <Newspaper className="w-4 h-4 mr-2" /> News
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer lg:hidden" onClick={() => nav('/contact')} data-testid="nav-mobile-contact">
            <Phone className="w-4 h-4 mr-2" /> Contact
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={onLogout}>
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
UserDropdownMenu.displayName = 'UserDropdownMenu';

// =========== Search Result Card (compact) ===========
const SearchResultCard = memo(({ match, onClick }) => {
  const isLive = match.status === 'LIVE';

  return (
    <button
      onClick={() => onClick(match)}
      className="w-full text-left px-4 sm:px-3 py-3 sm:py-2.5 hover:bg-[hsl(var(--card-hover))] transition-colors border-b border-border/30 last:border-b-0 group"
      data-testid={`search-result-${match.id}`}
    >
      {/* Competition + Status */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{match.competition}</span>
        {isLive ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            Live
          </span>
        ) : (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-primary/10 text-primary border border-primary/20">
            Upcoming
          </span>
        )}
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-between gap-2">
        {/* Home team */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {match.homeTeam.crest && (
            <img src={match.homeTeam.crest} alt="" className="w-4 h-4 rounded-full object-contain flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground truncate">{match.homeTeam.name}</span>
        </div>

        {/* Time / Score */}
        <div className="flex flex-col items-center flex-shrink-0 px-2">
          {isLive && match.score.home !== null ? (
            <span className="text-xs font-bold text-foreground tabular-nums">
              {match.score.home} - {match.score.away}
            </span>
          ) : (
            <span className="text-[10px] font-medium text-muted-foreground">{match.dateTime}</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-xs font-medium text-foreground truncate text-right">{match.awayTeam.name}</span>
          {match.awayTeam.crest && (
            <img src={match.awayTeam.crest} alt="" className="w-4 h-4 rounded-full object-contain flex-shrink-0" />
          )}
        </div>
      </div>

      {/* 1 / X / 2 row (display only) */}
      <div className="flex items-center gap-1 mt-1.5">
        <div className="flex-1 flex items-center justify-center gap-1 py-0.5 rounded bg-secondary/60 border border-border/30">
          <span className="text-[9px] text-muted-foreground">1</span>
          <span className="text-[10px] font-semibold text-primary tabular-nums">{match.votes.home.count}</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-1 py-0.5 rounded bg-secondary/60 border border-border/30">
          <span className="text-[9px] text-muted-foreground">X</span>
          <span className="text-[10px] font-semibold text-primary tabular-nums">{match.votes.draw.count}</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-1 py-0.5 rounded bg-secondary/60 border border-border/30">
          <span className="text-[9px] text-muted-foreground">2</span>
          <span className="text-[10px] font-semibold text-primary tabular-nums">{match.votes.away.count}</span>
        </div>
      </div>
    </button>
  );
});
SearchResultCard.displayName = 'SearchResultCard';

// =========== Search Component ===========
const GlobalSearch = ({ onMatchSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimer = useRef(null);

  // Open search
  const openSearch = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Close search
  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, []);

  // Debounced search
  const performSearch = useCallback(async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const data = await searchMatches(searchQuery);
      setResults(data.matches || []);
      setHasSearched(true);
    } catch {
      setResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      if (value.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceTimer.current = setTimeout(() => {
        performSearch(value.trim());
      }, 300);
    },
    [performSearch]
  );

  // Handle result click
  const handleResultClick = useCallback(
    (match) => {
      closeSearch();
      if (onMatchSelect) onMatchSelect(match.id);
    },
    [closeSearch, onMatchSelect]
  );

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) closeSearch();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSearch]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        closeSearch();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, closeSearch]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  if (!isOpen) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              onClick={openSearch}
              aria-label="Search"
              data-testid="header-search"
            >
              <Search className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Search matches</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5 w-[160px] sm:w-[240px] md:min-w-[320px] border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-all">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search teams..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
          data-testid="search-input"
        />
        {isSearching && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />}
        <button
          onClick={closeSearch}
          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          data-testid="search-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown — mobile-optimized */}
      {(query.length >= 2 || hasSearched) && (
        <div
          className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-[4.5rem] sm:top-full sm:mt-2 sm:w-[340px] md:w-[400px] max-h-[60vh] sm:max-h-[480px] overflow-y-auto overscroll-contain rounded-xl bg-card border border-border shadow-lg shadow-black/30 z-[100] scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
          data-testid="search-dropdown"
        >
          {/* Loading */}
          {isSearching && results.length === 0 && (
            <div className="flex items-center justify-center py-8 gap-2" data-testid="search-loading">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">Searching...</span>
            </div>
          )}

          {/* No results */}
          {!isSearching && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-1" data-testid="search-no-results">
              <Search className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-sm text-muted-foreground">No matches found</span>
              <span className="text-xs text-muted-foreground/60">Try a different team name</span>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div>
              {/* Group label */}
              <div className="px-4 sm:px-3 py-2.5 sm:py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/30">
                {results.length} match{results.length !== 1 ? 'es' : ''} found
              </div>
              {results.map((match) => (
                <SearchResultCard key={match.id} match={match} onClick={handleResultClick} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =========== Main Header ===========
export const Header = ({ user, isAuthenticated = false, onLogin, onLogout, onMatchSelect }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get pending friend request count
  let friendRequestCount = 0;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { pendingCount } = useFriends();
    friendRequestCount = pendingCount;
  } catch {
    friendRequestCount = 0;
  }

  // Get unread message and notification counts
  let messageCount = 0;
  let notifCount = 0;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { unreadMessages, unreadNotifications } = useMessages();
    messageCount = unreadMessages;
    notifCount = unreadNotifications;
  } catch {
    messageCount = 0;
    notifCount = 0;
  }

  const handleFeatureClick = useCallback((feature) => {
    if (feature === 'Friends') {
      navigate('/friends');
    } else if (feature === 'Messages') {
      navigate('/messages');
    } else if (feature === 'Notifications') {
      navigate('/messages'); // Notifications shown in messages for now
    }
  }, [navigate]);

  const handleLoginClick = useCallback(() => {
    if (onLogin) onLogin();
    else navigate('/login');
  }, [onLogin, navigate]);

  const handleRegisterClick = useCallback(() => {
    navigate('/register');
  }, [navigate]);

  // Handle match selection from search
  const handleMatchSelect = useCallback(
    (matchId) => {
      // If onMatchSelect prop exists, use it
      if (onMatchSelect) {
        onMatchSelect(matchId);
        return;
      }

      // Navigate to home if not there
      if (location.pathname !== '/') {
        navigate('/', { state: { highlightMatchId: matchId } });
      } else {
        // Scroll to the match and highlight it
        const matchEl = document.querySelector(`[data-match-id="${matchId}"]`);
        if (matchEl) {
          matchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          matchEl.classList.add('match-highlight');
          setTimeout(() => matchEl.classList.remove('match-highlight'), 2500);
        }
      }
    },
    [onMatchSelect, location.pathname, navigate]
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 no-underline"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                navigate('/');
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
              }
            }}
            data-testid="header-logo"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
              <span className="text-primary font-bold text-lg">G</span>
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-primary">GUESS</span>
              <span className="text-foreground">IT</span>
            </span>
          </Link>

          {/* Navigation Links - Hidden on mobile */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center" data-testid="header-nav">
            <Link to="/how-it-works" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" data-testid="nav-how-it-works">
              How It Works
            </Link>
            <Link to="/leaderboard" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" data-testid="nav-leaderboard">
              Leaderboard
            </Link>
            <Link to="/about" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" data-testid="nav-about">
              About Us
            </Link>
            <Link to="/news" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" data-testid="nav-news">
              News
            </Link>
            <Link to="/contact" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" data-testid="nav-contact">
              Contact
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 min-w-0 flex-shrink-0">
            {/* Global Search */}
            <GlobalSearch onMatchSelect={handleMatchSelect} />

            {/* Auth icons — hide on small screens */}
            {isAuthenticated && (
              <>
                <span className="hidden sm:inline-flex">
                  <HeaderIconButton icon={Mail} badge={messageCount} onClick={() => handleFeatureClick('Messages')} tooltip="Messages" testId="header-messages" />
                </span>
                <span className="hidden sm:inline-flex">
                  <HeaderIconButton icon={Users} badge={friendRequestCount} onClick={() => handleFeatureClick('Friends')} tooltip="Friend Requests" testId="header-friends" />
                </span>
                <NotificationDropdown />
              </>
            )}

            {/* Theme Toggle */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    data-testid="theme-toggle"
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-400" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Login/Register */}
            {!isAuthenticated && (
              <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground px-2 sm:px-3" onClick={handleLoginClick} data-testid="header-login">
                  <LogIn className="w-4 h-4 mr-1 sm:mr-2 hidden sm:inline" />
                  <span className="text-xs sm:text-sm">Login</span>
                </Button>
                <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground px-2 sm:px-3" onClick={handleRegisterClick} data-testid="header-register">
                  <UserPlus className="w-4 h-4 mr-1 sm:mr-2 hidden sm:inline" />
                  <span className="text-xs sm:text-sm">Register</span>
                </Button>
              </div>
            )}

            {/* User avatar */}
            {isAuthenticated && <UserDropdownMenu user={user} onLogout={onLogout} />}

            {/* Mobile menu */}
            <Button variant="ghost" size="icon" className="ml-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:hidden" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
