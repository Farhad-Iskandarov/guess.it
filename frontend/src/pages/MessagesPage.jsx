import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useMessages } from '@/lib/MessagesContext';
import { getChatHistory, sendMessage, markMessagesRead } from '@/services/messages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Send, ChevronLeft, MessageSquare, Loader2, ArrowDown, Circle, Clock
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============ Time Formatting ============
function formatTime(dateString) {
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateString) {
  const d = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatLastSeen(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Last seen just now';
  if (diff < 3600) return `Last seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)}h ago`;
  return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

function formatConvoTime(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ============ Online Indicator ============
const OnlineIndicator = memo(({ isOnline, size = 'sm' }) => {
  if (isOnline === null || isOnline === undefined) return null;
  const sizeClass = size === 'lg' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  return (
    <Circle
      className={`${sizeClass} ${isOnline ? 'fill-emerald-500 text-emerald-500' : 'fill-zinc-400 text-zinc-400'}`}
      data-testid={`online-indicator-${isOnline ? 'online' : 'offline'}`}
    />
  );
});
OnlineIndicator.displayName = 'OnlineIndicator';

// ============ Conversation Item ============
const ConversationItem = memo(({ convo, isActive, onClick }) => {
  const initials = (convo.nickname || 'U').charAt(0).toUpperCase();
  const picSrc = convo.picture?.startsWith('/') ? `${API_URL}${convo.picture}` : convo.picture;

  return (
    <button
      onClick={() => onClick(convo)}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150 border-b border-border/30 text-left ${
        isActive
          ? 'bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-secondary/50'
      }`}
      data-testid={`convo-item-${convo.user_id}`}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="w-11 h-11 border border-border">
          <AvatarImage src={picSrc} alt={convo.nickname} />
          <AvatarFallback className="bg-primary/15 text-primary font-semibold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        {convo.is_online !== null && (
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
            convo.is_online ? 'bg-emerald-500' : 'bg-zinc-400'
          }`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold truncate ${convo.unread_count > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
            {convo.nickname}
          </span>
          {convo.last_message?.created_at && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {formatConvoTime(convo.last_message.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-xs truncate ${convo.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            {convo.last_message
              ? `${convo.last_message.is_mine ? 'You: ' : ''}${convo.last_message.message}`
              : 'Start a conversation'}
          </p>
          {convo.unread_count > 0 && (
            <span className="flex-shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold" data-testid={`unread-badge-${convo.user_id}`}>
              {convo.unread_count > 99 ? '99+' : convo.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
ConversationItem.displayName = 'ConversationItem';

// ============ Message Bubble ============
const MessageBubble = memo(({ msg, isMine }) => (
  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
    <div
      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
        isMine
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'bg-secondary text-foreground rounded-bl-md'
      }`}
      data-testid={`message-bubble-${msg.message_id}`}
    >
      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
      <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'} text-right`}>
        {formatTime(msg.created_at)}
      </p>
    </div>
  </div>
));
MessageBubble.displayName = 'MessageBubble';

// ============ Date Separator ============
const DateSeparator = memo(({ date }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-border/50" />
    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{date}</span>
    <div className="flex-1 h-px bg-border/50" />
  </div>
));
DateSeparator.displayName = 'DateSeparator';

// ============ Chat Panel ============
const ChatPanel = ({ friend, userId, onBack }) => {
  const { addChatListener, markConversationRead } = useMessages();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);

  const picSrc = friend.picture?.startsWith('/') ? `${API_URL}${friend.picture}` : friend.picture;

  // Load chat history
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);

    const load = async () => {
      try {
        const data = await getChatHistory(friend.user_id);
        if (!cancelled) {
          setMessages(data.messages || []);
          // Mark as read
          if (data.messages?.some(m => m.sender_id === friend.user_id && !m.read)) {
            const unreadCount = data.messages.filter(m => m.sender_id === friend.user_id && !m.read).length;
            markMessagesRead(friend.user_id);
            markConversationRead(friend.user_id, unreadCount);
          }
        }
      } catch (e) {
        console.error('Failed to load chat:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [friend.user_id, markConversationRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!loading) {
      messagesEndRef.current?.scrollIntoView({ behavior: messages.length > 10 ? 'auto' : 'smooth' });
    }
  }, [messages.length, loading]);

  // Focus input when friend changes
  useEffect(() => {
    if (!loading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [friend.user_id, loading]);

  // Listen for real-time messages
  useEffect(() => {
    const remove = addChatListener((data) => {
      if (data.type === 'new_message' && data.message.sender_id === friend.user_id) {
        setMessages(prev => [...prev, {
          message_id: data.message.message_id,
          sender_id: data.message.sender_id,
          receiver_id: userId,
          message: data.message.message,
          created_at: data.message.created_at,
          read: true
        }]);
        // Mark as read immediately
        markMessagesRead(friend.user_id);
        markConversationRead(friend.user_id, 1);
      } else if (data.type === 'messages_read' && data.reader_id === friend.user_id) {
        // Our messages were read
        setMessages(prev => prev.map(m =>
          m.sender_id === userId && !m.read ? { ...m, read: true } : m
        ));
      }
    });
    return remove;
  }, [friend.user_id, userId, addChatListener, markConversationRead]);

  // Handle scroll indicator
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollDown(!isNearBottom);
  }, []);

  // Send message
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      message_id: tempId,
      sender_id: userId,
      receiver_id: friend.user_id,
      message: text,
      created_at: new Date().toISOString(),
      read: false
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const result = await sendMessage(friend.user_id, text);
      // Replace temp message with real one
      setMessages(prev =>
        prev.map(m => m.message_id === tempId
          ? { ...m, message_id: result.message_id, created_at: result.created_at }
          : m
        )
      );
    } catch (e) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.message_id !== tempId));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, userId, friend.user_id]);

  // Enter to send
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Group messages by date
  const groupedMessages = [];
  let lastDate = '';
  for (const msg of messages) {
    const dateStr = formatDateSeparator(msg.created_at);
    if (dateStr !== lastDate) {
      groupedMessages.push({ type: 'date', date: dateStr, key: `date-${msg.created_at}` });
      lastDate = dateStr;
    }
    groupedMessages.push({ type: 'msg', msg, key: msg.message_id });
  }

  return (
    <div className="flex flex-col h-full" data-testid="chat-panel">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden rounded-full flex-shrink-0"
          onClick={onBack}
          data-testid="chat-back-btn"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10 border border-border flex-shrink-0">
          <AvatarImage src={picSrc} alt={friend.nickname} />
          <AvatarFallback className="bg-primary/15 text-primary font-semibold">
            {(friend.nickname || 'U').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{friend.nickname}</p>
          <div className="flex items-center gap-1.5">
            {friend.is_online !== null && (
              <>
                <OnlineIndicator isOnline={friend.is_online} />
                <span className="text-[11px] text-muted-foreground">
                  {friend.is_online ? 'Online' : formatLastSeen(friend.last_seen)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 scrollbar-hide relative"
        data-testid="messages-area"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7 text-primary/50" />
            </div>
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Say hello to {friend.nickname}!</p>
          </div>
        ) : (
          <>
            {groupedMessages.map(item =>
              item.type === 'date' ? (
                <DateSeparator key={item.key} date={item.date} />
              ) : (
                <MessageBubble
                  key={item.key}
                  msg={item.msg}
                  isMine={item.msg.sender_id === userId}
                />
              )
            )}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Scroll to bottom button */}
        {showScrollDown && (
          <button
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary transition-colors"
            data-testid="scroll-down-btn"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Input Area */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${friend.nickname}...`}
          className="flex-1"
          maxLength={2000}
          data-testid="chat-input"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="rounded-full flex-shrink-0"
          data-testid="chat-send-btn"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

// ============ Main Messages Page ============
export const MessagesPage = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { conversations, fetchConversations } = useMessages();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeFriend, setActiveFriend] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Load conversations
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchConversations();
      setLoading(false);
    };
    if (isAuthenticated) load();
  }, [isAuthenticated, fetchConversations]);

  // Open specific chat from navigation state (e.g., from Friends page "Message" button)
  useEffect(() => {
    if (location.state?.openChat && !loading) {
      const friend = location.state.openChat;
      setActiveFriend(friend);
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state, loading]);

  // Filter conversations by search
  const filteredConvos = searchQuery
    ? conversations.filter(c =>
        c.nickname?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  const handleSelectConvo = useCallback((convo) => {
    setActiveFriend(convo);
  }, []);

  const handleBack = useCallback(() => {
    setActiveFriend(null);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="messages-page">
        <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
        <main className="flex items-center justify-center" style={{ height: 'calc(100vh - 4rem)' }}>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="messages-page">
      <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      <main className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Sidebar — conversation list */}
        <div
          className={`w-full md:w-[340px] lg:w-[380px] flex-shrink-0 border-r border-border flex flex-col bg-card/30 ${
            activeFriend ? 'hidden md:flex' : 'flex'
          }`}
          data-testid="conversations-sidebar"
        >
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-foreground">Messages</h1>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
                data-testid="convo-search-input"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide" data-testid="conversations-list">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredConvos.length > 0 ? (
              filteredConvos.map(convo => (
                <ConversationItem
                  key={convo.user_id}
                  convo={convo}
                  isActive={activeFriend?.user_id === convo.user_id}
                  onClick={handleSelectConvo}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground/70">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery ? 'Try a different search' : 'Add friends to start chatting!'}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate('/friends')}
                    data-testid="find-friends-btn"
                  >
                    Find Friends
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div
          className={`flex-1 flex flex-col ${
            activeFriend ? 'flex' : 'hidden md:flex'
          }`}
          data-testid="chat-area"
        >
          {activeFriend ? (
            <ChatPanel
              friend={activeFriend}
              userId={user?.user_id}
              onBack={handleBack}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-9 h-9 text-primary/40" />
              </div>
              <h2 className="text-lg font-semibold text-foreground/70 mb-1">Select a conversation</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Choose a friend from the list to start chatting
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MessagesPage;
