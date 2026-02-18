import { useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Mail, Users, Bell, Menu, Sun, Moon, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from '@/lib/ThemeContext';
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

// Memoized notification badge - only shows when count > 0
const NotificationBadge = memo(({ count }) => {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground badge-pulse">
      {count > 99 ? '99+' : count}
    </span>
  );
});

NotificationBadge.displayName = 'NotificationBadge';

// Memoized header icon button with tooltip
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

// User Avatar Dropdown Menu (for authenticated users)
const UserDropdownMenu = memo(({ user, onLogout }) => {
  const displayName = user?.nickname || user?.name || user?.email || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-full">
          <Avatar className="h-9 w-9 border-2 border-primary/50 cursor-pointer hover:border-primary transition-colors">
            <AvatarImage src={user?.picture} alt={displayName} />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
              {initials}
            </AvatarFallback>
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
        <DropdownMenuItem className="cursor-pointer">
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          My Predictions
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={onLogout}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

UserDropdownMenu.displayName = 'UserDropdownMenu';

export const Header = ({ user, isAuthenticated = false, onLogin, onLogout, notifications = {} }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Handle navigation for authenticated features
  const handleFeatureClick = useCallback((feature) => {
    console.log(`Navigating to ${feature}`);
    // In real app: navigate(`/${feature.toLowerCase()}`);
  }, []);

  // Handle login button click
  const handleLoginClick = useCallback(() => {
    if (onLogin) {
      onLogin();
    } else {
      navigate('/login');
    }
  }, [onLogin, navigate]);

  // Handle register button click
  const handleRegisterClick = useCallback(() => {
    navigate('/register');
  }, [navigate]);

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - Always visible */}
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
              <span className="text-primary font-bold text-lg">G</span>
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-primary">GUESS</span>
              <span className="text-foreground">IT</span>
            </span>
          </Link>

          {/* Right side navigation */}
          <div className="flex items-center gap-1 md:gap-2">
            
            {/* Search - Always visible (optional) */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Search"
                    data-testid="header-search"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Search</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* ===== AUTHENTICATED USER ICONS ===== */}
            {isAuthenticated && (
              <>
                {/* Messages - Only for authenticated users */}
                <HeaderIconButton
                  icon={Mail}
                  badge={notifications?.messages}
                  onClick={() => handleFeatureClick('Messages')}
                  tooltip="Messages"
                  testId="header-messages"
                />

                {/* Friends - Only for authenticated users */}
                <HeaderIconButton
                  icon={Users}
                  badge={notifications?.friends}
                  onClick={() => handleFeatureClick('Friends')}
                  tooltip="Friend Requests"
                  testId="header-friends"
                />

                {/* Notifications - Only for authenticated users */}
                <HeaderIconButton
                  icon={Bell}
                  badge={notifications?.alerts}
                  onClick={() => handleFeatureClick('Notifications')}
                  tooltip="Notifications"
                  testId="header-notifications"
                />
              </>
            )}

            {/* Theme Toggle - Always visible */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    data-testid="theme-toggle"
                    className="w-10 h-10 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {theme === 'light' ? (
                      <Moon className="w-5 h-5" />
                    ) : (
                      <Sun className="w-5 h-5 text-yellow-400" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* ===== NOT AUTHENTICATED - LOGIN/REGISTER BUTTONS ===== */}
            {!isAuthenticated && (
              <div className="flex items-center gap-2 ml-2">
                {/* Login Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleLoginClick}
                  data-testid="header-login"
                >
                  <LogIn className="w-4 h-4 mr-2 hidden sm:inline" />
                  <span>Login</span>
                </Button>

                {/* Register Button */}
                <Button
                  variant="default"
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleRegisterClick}
                  data-testid="header-register"
                >
                  <UserPlus className="w-4 h-4 mr-2 hidden sm:inline" />
                  <span>Register</span>
                </Button>
              </div>
            )}

            {/* ===== AUTHENTICATED - USER AVATAR WITH DROPDOWN ===== */}
            {isAuthenticated && (
              <UserDropdownMenu user={user} onLogout={onLogout} />
            )}

            {/* Menu (Mobile) - Always visible */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
