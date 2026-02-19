import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useFriends } from '@/lib/FriendsContext';
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend
} from '@/services/friends';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search, Users, UserPlus, UserMinus, UserCheck, UserX, Clock,
  Loader2, ChevronLeft, Trophy, Zap, Send, X, Check, AlertCircle, MessageSquare
} from 'lucide-react';

// ============ User Card ============
const UserCard = memo(({ user, action, actionLabel, actionIcon: ActionIcon, onAction, isLoading, variant = 'default', onMessage }) => {
  const initials = (user.nickname || 'U').charAt(0).toUpperCase();
  
  return (
    <div 
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
        variant === 'incoming' ? 'bg-primary/5 border-primary/20' :
        variant === 'outgoing' ? 'bg-muted/50 border-border/50' :
        'bg-card border-border/50 hover:border-primary/30'
      }`}
      data-testid={`user-card-${user.user_id}`}
    >
      <Link to={`/profile/${user.user_id}`} className="flex-shrink-0">
        <Avatar className="w-12 h-12 border-2 border-background shadow">
          <AvatarImage src={user.picture} alt={user.nickname} />
          <AvatarFallback className="bg-primary/20 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </Link>
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{user.nickname}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            Level {user.level || 0}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            {user.points || 0} pts
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onMessage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMessage(user)}
            className="gap-1.5 text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
            data-testid={`message-btn-${user.user_id}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Message</span>
          </Button>
        )}
        {action && (
          <Button
            variant={action === 'remove' || action === 'decline' ? 'ghost' : 'default'}
            size="sm"
            onClick={() => onAction(user)}
            disabled={isLoading}
            className={`gap-1.5 ${
              action === 'remove' || action === 'decline' 
                ? 'text-destructive hover:text-destructive hover:bg-destructive/10' 
                : ''
            }`}
            data-testid={`${action}-btn-${user.user_id}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              ActionIcon && <ActionIcon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{actionLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
});
UserCard.displayName = 'UserCard';

// ============ Friend Request Card ============
const FriendRequestCard = memo(({ request, type, onAccept, onDecline, onCancel, isLoading }) => {
  const user = type === 'incoming' 
    ? {
        user_id: request.sender_id,
        nickname: request.sender_nickname,
        picture: request.sender_picture,
        level: request.sender_level,
        points: request.sender_points
      }
    : {
        user_id: request.receiver_id,
        nickname: request.receiver_nickname,
        picture: request.receiver_picture,
        level: request.receiver_level,
        points: request.receiver_points
      };
  
  const initials = (user.nickname || 'U').charAt(0).toUpperCase();
  const timeAgo = request.created_at ? formatTimeAgo(request.created_at) : '';
  
  return (
    <div 
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
        type === 'incoming' ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border/50'
      }`}
      data-testid={`request-card-${request.request_id}`}
    >
      <Avatar className="w-12 h-12 border-2 border-background shadow flex-shrink-0">
        <AvatarImage src={user.picture} alt={user.nickname} />
        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{user.nickname}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            Level {user.level || 0}
          </span>
          {timeAgo && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo}
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {type === 'incoming' ? (
          <>
            <Button
              size="sm"
              onClick={() => onAccept(request)}
              disabled={isLoading}
              className="gap-1.5"
              data-testid={`accept-btn-${request.request_id}`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span className="hidden sm:inline">Accept</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDecline(request)}
              disabled={isLoading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              data-testid={`decline-btn-${request.request_id}`}
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(request)}
            disabled={isLoading}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
            data-testid={`cancel-btn-${request.request_id}`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            <span className="hidden sm:inline">Cancel</span>
          </Button>
        )}
      </div>
    </div>
  );
});
FriendRequestCard.displayName = 'FriendRequestCard';

// ============ Search Result Card ============
const SearchResultCard = memo(({ user, onSendRequest, isLoading }) => {
  const initials = (user.nickname || 'U').charAt(0).toUpperCase();
  
  const getStatusButton = () => {
    switch (user.status) {
      case 'friend':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm">
            <UserCheck className="w-4 h-4" />
            Friends
          </span>
        );
      case 'request_sent':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        );
      case 'request_received':
        return (
          <Link to="/friends">
            <Button size="sm" variant="outline" className="gap-1.5">
              <UserPlus className="w-4 h-4" />
              View Request
            </Button>
          </Link>
        );
      default:
        return (
          <Button
            size="sm"
            onClick={() => onSendRequest(user)}
            disabled={isLoading}
            className="gap-1.5"
            data-testid={`send-request-btn-${user.user_id}`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Add Friend
          </Button>
        );
    }
  };
  
  return (
    <div 
      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-200"
      data-testid={`search-result-${user.user_id}`}
    >
      <Avatar className="w-12 h-12 border-2 border-background shadow flex-shrink-0">
        <AvatarImage src={user.picture} alt={user.nickname} />
        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{user.nickname}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            Level {user.level || 0}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            {user.points || 0} pts
          </span>
        </div>
      </div>
      
      {getStatusButton()}
    </div>
  );
});
SearchResultCard.displayName = 'SearchResultCard';

// ============ Section Header ============
const SectionHeader = memo(({ icon: Icon, title, count, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {count !== undefined && (
        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
          {count}
        </span>
      )}
    </div>
    {action}
  </div>
));
SectionHeader.displayName = 'SectionHeader';

// ============ Empty State ============
const EmptyState = memo(({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-muted-foreground/50" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
    {action}
  </div>
));
EmptyState.displayName = 'EmptyState';

// ============ Helper Functions ============
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

// ============ Main Friends Page ============
export const FriendsPage = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { 
    pendingRequests, 
    friends, 
    fetchPendingRequests, 
    fetchFriends,
    addFriendLocal,
    removeFriendLocal,
    decrementPendingCount
  } = useFriends();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);

  // Search users
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchUsers(searchQuery);
        setSearchResults(data.users || []);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Handle send friend request
  const handleSendRequest = useCallback(async (targetUser) => {
    setLoadingAction(targetUser.user_id);
    try {
      await sendFriendRequest(targetUser.nickname);
      toast.success(`Friend request sent to ${targetUser.nickname}`);
      // Update search results to show pending status
      setSearchResults(prev => 
        prev.map(u => u.user_id === targetUser.user_id ? { ...u, status: 'request_sent' } : u)
      );
      fetchPendingRequests(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAction(null);
    }
  }, [fetchPendingRequests]);

  // Handle accept request
  const handleAccept = useCallback(async (request) => {
    setLoadingAction(request.request_id);
    try {
      const result = await acceptFriendRequest(request.request_id);
      toast.success(result.message);
      if (result.friend) {
        addFriendLocal(result.friend);
      }
      decrementPendingCount();
      fetchPendingRequests(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAction(null);
    }
  }, [addFriendLocal, decrementPendingCount, fetchPendingRequests]);

  // Handle decline request
  const handleDecline = useCallback(async (request) => {
    setLoadingAction(request.request_id);
    try {
      await declineFriendRequest(request.request_id);
      toast.success('Friend request declined');
      decrementPendingCount();
      fetchPendingRequests(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAction(null);
    }
  }, [decrementPendingCount, fetchPendingRequests]);

  // Handle cancel request
  const handleCancel = useCallback(async (request) => {
    setLoadingAction(request.request_id);
    try {
      await cancelFriendRequest(request.request_id);
      toast.success('Friend request cancelled');
      fetchPendingRequests(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAction(null);
    }
  }, [fetchPendingRequests]);

  // Handle remove friend
  const handleRemoveFriend = useCallback(async (friend) => {
    setLoadingAction(friend.user_id);
    try {
      await removeFriend(friend.user_id);
      toast.success(`Removed ${friend.nickname} from friends`);
      removeFriendLocal(friend.user_id);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAction(null);
    }
  }, [removeFriendLocal]);

  // Handle message friend - navigate to /messages with friend pre-selected
  const handleMessageFriend = useCallback((friend) => {
    navigate('/messages', { state: { openChat: friend } });
  }, [navigate]);

  // Friend list filter
  const [friendFilter, setFriendFilter] = useState('');
  const filteredFriends = useMemo(() => {
    if (!friendFilter) return friends;
    const q = friendFilter.toLowerCase();
    return friends.filter(f => f.nickname?.toLowerCase().includes(q));
  }, [friends, friendFilter]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchPendingRequests(true);
      fetchFriends(true);
    }
  }, [isAuthenticated, fetchPendingRequests, fetchFriends]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="friends-page">
        <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
        <main className="container mx-auto px-4 md:px-6 py-8 max-w-3xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="friends-page">
      <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      
      <main className="container mx-auto px-4 md:px-6 py-8 max-w-3xl">
        {/* Back button & Title */}
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="rounded-full"
            data-testid="back-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Friends</h1>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search users by nickname..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
            data-testid="search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="mb-6 animate-fade-in">
            <SectionHeader icon={Search} title="Search Results" count={searchResults.length} />
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map(user => (
                  <SearchResultCard
                    key={user.user_id}
                    user={user}
                    onSendRequest={handleSendRequest}
                    isLoading={loadingAction === user.user_id}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No users found matching "{searchQuery}"</p>
            )}
            <Separator className="my-6" />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="friends" className="gap-2" data-testid="tab-friends">
              <Users className="w-4 h-4" />
              Friends
              {friends.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                  {friends.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="incoming" className="gap-2" data-testid="tab-incoming">
              <UserPlus className="w-4 h-4" />
              Incoming
              {pendingRequests.incoming.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs">
                  {pendingRequests.incoming.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="gap-2" data-testid="tab-outgoing">
              <Send className="w-4 h-4" />
              Sent
              {pendingRequests.outgoing.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                  {pendingRequests.outgoing.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Friends Tab */}
          <TabsContent value="friends" className="space-y-2">
            {friends.length > 5 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter friends..."
                  value={friendFilter}
                  onChange={(e) => setFriendFilter(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm"
                  data-testid="friend-filter-input"
                />
                {friendFilter && (
                  <button
                    onClick={() => setFriendFilter('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {filteredFriends.length > 0 ? (
              filteredFriends.map(friend => (
                <UserCard
                  key={friend.user_id}
                  user={friend}
                  action="remove"
                  actionLabel="Remove"
                  actionIcon={UserMinus}
                  onAction={handleRemoveFriend}
                  onMessage={handleMessageFriend}
                  isLoading={loadingAction === friend.user_id}
                />
              ))
            ) : friendFilter ? (
              <p className="text-center text-muted-foreground py-8">No friends matching "{friendFilter}"</p>
            ) : (
              <EmptyState
                icon={Users}
                title="No friends yet"
                description="Search for users by their nickname and send them a friend request!"
              />
            )}
          </TabsContent>

          {/* Incoming Requests Tab */}
          <TabsContent value="incoming" className="space-y-2">
            {pendingRequests.incoming.length > 0 ? (
              pendingRequests.incoming.map(request => (
                <FriendRequestCard
                  key={request.request_id}
                  request={request}
                  type="incoming"
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  isLoading={loadingAction === request.request_id}
                />
              ))
            ) : (
              <EmptyState
                icon={UserPlus}
                title="No pending requests"
                description="When someone sends you a friend request, it will appear here."
              />
            )}
          </TabsContent>

          {/* Outgoing Requests Tab */}
          <TabsContent value="outgoing" className="space-y-2">
            {pendingRequests.outgoing.length > 0 ? (
              pendingRequests.outgoing.map(request => (
                <FriendRequestCard
                  key={request.request_id}
                  request={request}
                  type="outgoing"
                  onCancel={handleCancel}
                  isLoading={loadingAction === request.request_id}
                />
              ))
            ) : (
              <EmptyState
                icon={Send}
                title="No sent requests"
                description="Friend requests you send will appear here until they are accepted or declined."
              />
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default FriendsPage;
