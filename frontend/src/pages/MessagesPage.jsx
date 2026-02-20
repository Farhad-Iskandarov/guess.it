import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/lib/AuthContext';
import { useMessages } from '@/lib/MessagesContext';
import { getChatHistory, sendMessage, markMessagesRead, markMessagesDelivered } from '@/services/messages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Search, Send, ChevronLeft, MessageSquare, Loader2, ArrowDown, Circle,
  Check, CheckCheck, Plus, X, Trophy
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============ Sanitize text for display (XSS) ============
function sanitizeDisplay(text) {
  if (!text) return '';
  // React already escapes via JSX, but ensure no raw HTML
  return String(text);
}

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

// ============ Message Status Icon ============
const MessageStatus = memo(({ delivered, read, isMine }) => {
  if (!isMine) return null;
  if (read) {
    return (
      <span className="msg-status-icon" data-testid="msg-status-read">
        <CheckCheck className="msg-check msg-check-read w-3.5 h-3.5" />
      </span>
    );
  }
  if (delivered) {
    return (
      <span className="msg-status-icon" data-testid="msg-status-delivered">
        <CheckCheck className="msg-check msg-check-delivered w-3.5 h-3.5 opacity-50" />
      </span>
    );
  }
  return (
    <span className="msg-status-icon" data-testid="msg-status-sent">
      <Check className="msg-check msg-check-single w-3.5 h-3.5 opacity-40" />
    </span>
  );
});
MessageStatus.displayName = 'MessageStatus';

// ============ Shared Match Card in Chat ============
const SharedMatchCard = memo(({ matchData, isMine }) => {
  const navigate = useNavigate();
  if (!matchData) return null;

  return (
    <div
      className="chat-match-card mt-1 mb-1"
      onClick={() => navigate('/')}
      data-testid="shared-match-card"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Trophy className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-medium text-muted-foreground truncate">
          {sanitizeDisplay(matchData.competition)}
        </span>
        {matchData.status && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
            matchData.status === 'LIVE' ? 'bg-red-500/20 text-red-400' :
            matchData.status === 'FINISHED' ? 'bg-muted text-muted-foreground' :
            'bg-blue-500/15 text-blue-400'
          }`}>
            {matchData.status === 'LIVE' ? 'LIVE' : matchData.status === 'FINISHED' ? 'FT' : 'Upcoming'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            {matchData.homeTeam?.crest && (
              <img src={matchData.homeTeam.crest} alt="" className="w-4 h-4 rounded-full object-contain bg-secondary" />
            )}
            <span className={`text-xs font-medium truncate ${isMine ? 'text-primary-foreground/90' : 'text-foreground'}`}>
              {sanitizeDisplay(matchData.homeTeam?.name || matchData.home_team || '')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {matchData.awayTeam?.crest && (
              <img src={matchData.awayTeam.crest} alt="" className="w-4 h-4 rounded-full object-contain bg-secondary" />
            )}
            <span className={`text-xs font-medium truncate ${isMine ? 'text-primary-foreground/90' : 'text-foreground'}`}>
              {sanitizeDisplay(matchData.awayTeam?.name || matchData.away_team || '')}
            </span>
          </div>
        </div>
        {matchData.score && matchData.score.home !== null && matchData.score.home !== undefined && (
          <div className="flex items-center gap-1 text-sm font-bold tabular-nums flex-shrink-0">
            <span className={isMine ? 'text-primary-foreground' : 'text-foreground'}>{matchData.score.home}</span>
            <span className={`text-xs ${isMine ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>-</span>
            <span className={isMine ? 'text-primary-foreground' : 'text-foreground'}>{matchData.score.away}</span>
          </div>
        )}
      </div>
      {matchData.dateTime && (
        <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
          {sanitizeDisplay(matchData.dateTime)}
        </p>
      )}
    </div>
  );
});
SharedMatchCard.displayName = 'SharedMatchCard';

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
            {sanitizeDisplay(convo.nickname)}
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
              ? `${convo.last_message.is_mine ? 'You: ' : ''}${sanitizeDisplay(convo.last_message.message)}`
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
const MessageBubble = memo(({ msg, isMine, privacy }) => {
  const isMatchShare = msg.message_type === 'match_share';

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isMine
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-secondary text-foreground rounded-bl-md'
        }`}
        data-testid={`message-bubble-${msg.message_id}`}
      >
        {isMatchShare && msg.match_data ? (
          <SharedMatchCard matchData={msg.match_data} isMine={isMine} />
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{sanitizeDisplay(msg.message)}</p>
        )}
        <div className={`flex items-center justify-end gap-0.5 mt-0.5`}>
          <span className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
            {formatTime(msg.created_at)}
          </span>
          {isMine && privacy && (
            <MessageStatus
              delivered={msg.delivered}
              read={msg.read}
              isMine={true}
            />
          )}
        </div>
      </div>
    </div>
  );
});
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

// ============ Match Share Modal ============
const MatchShareModal = memo(({ isOpen, onClose, onSelect }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`${API_URL}/api/football/matches`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setMatches(data.matches || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen]);

  const filtered = search
    ? matches.filter(m =>
        m.homeTeam?.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.awayTeam?.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.competition?.toLowerCase().includes(search.toLowerCase())
      )
    : matches;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Share a Match</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search matches..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="match-share-search"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0" data-testid="match-share-list">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No matches found</p>
          ) : (
            filtered.slice(0, 30).map(match => (
              <button
                key={match.id}
                onClick={() => onSelect(match)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary/60 border border-transparent hover:border-border/50 transition-all"
                data-testid={`match-share-item-${match.id}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-muted-foreground truncate">{match.competition}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    match.status === 'LIVE' ? 'bg-red-500/20 text-red-400' :
                    match.status === 'FINISHED' ? 'bg-muted text-muted-foreground' :
                    'bg-blue-500/15 text-blue-400'
                  }`}>
                    {match.status === 'LIVE' ? 'LIVE' : match.status === 'FINISHED' ? 'FT' : 'Soon'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {match.homeTeam?.crest && <img src={match.homeTeam.crest} alt="" className="w-4 h-4 rounded-full object-contain bg-secondary" />}
                      <span className="text-xs font-medium truncate">{match.homeTeam?.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {match.awayTeam?.crest && <img src={match.awayTeam.crest} alt="" className="w-4 h-4 rounded-full object-contain bg-secondary" />}
                      <span className="text-xs font-medium truncate">{match.awayTeam?.name}</span>
                    </div>
                  </div>
                  {match.score && match.score.home !== null && (
                    <span className="text-sm font-bold tabular-nums">{match.score.home} - {match.score.away}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
MatchShareModal.displayName = 'MatchShareModal';

// ============ Chat Panel ============
const ChatPanel = ({ friend, userId, onBack }) => {
  const { addChatListener, markConversationRead } = useMessages();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [privacy, setPrivacy] = useState({ read_receipts: true, delivery_status: true });
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
          setPrivacy(data.privacy || { read_receipts: true, delivery_status: true });
          // Mark as read
          if (data.messages?.some(m => m.sender_id === friend.user_id && !m.read)) {
            const unreadCount = data.messages.filter(m => m.sender_id === friend.user_id && !m.read).length;
            markMessagesRead(friend.user_id);
            markConversationRead(friend.user_id, unreadCount);
          }
          // Mark as delivered
          if (data.messages?.some(m => m.sender_id === friend.user_id && !m.delivered)) {
            markMessagesDelivered(friend.user_id);
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

  // Focus input
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
          message_type: data.message.message_type || 'text',
          match_data: data.message.match_data,
          created_at: data.message.created_at,
          delivered: true,
          read: true
        }]);
        markMessagesRead(friend.user_id);
        markConversationRead(friend.user_id, 1);
      } else if (data.type === 'messages_read' && data.reader_id === friend.user_id) {
        setMessages(prev => prev.map(m =>
          m.sender_id === userId && !m.read ? { ...m, read: true, read_at: data.read_at } : m
        ));
      } else if (data.type === 'message_delivered' && data.message_id) {
        setMessages(prev => prev.map(m =>
          m.message_id === data.message_id ? { ...m, delivered: true, delivered_at: data.delivered_at } : m
        ));
      } else if (data.type === 'messages_delivered' && data.receiver_id === friend.user_id) {
        setMessages(prev => prev.map(m =>
          m.sender_id === userId && !m.delivered ? { ...m, delivered: true } : m
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

  // Send text message
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      message_id: tempId,
      sender_id: userId,
      receiver_id: friend.user_id,
      message: text,
      message_type: 'text',
      created_at: new Date().toISOString(),
      delivered: false,
      read: false
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const result = await sendMessage(friend.user_id, text, 'text');
      setMessages(prev =>
        prev.map(m => m.message_id === tempId
          ? { ...m, message_id: result.message_id, created_at: result.created_at, delivered: result.delivered }
          : m
        )
      );
    } catch (e) {
      setMessages(prev => prev.filter(m => m.message_id !== tempId));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, userId, friend.user_id]);

  // Share match
  const handleShareMatch = useCallback(async (match) => {
    setShowMatchModal(false);
    setSending(true);

    const matchData = {
      match_id: match.id,
      homeTeam: { name: match.homeTeam?.name, crest: match.homeTeam?.crest },
      awayTeam: { name: match.awayTeam?.name, crest: match.awayTeam?.crest },
      score: match.score || {},
      status: match.status,
      dateTime: match.dateTime,
      competition: match.competition
    };

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      message_id: tempId,
      sender_id: userId,
      receiver_id: friend.user_id,
      message: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
      message_type: 'match_share',
      match_data: matchData,
      created_at: new Date().toISOString(),
      delivered: false,
      read: false
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const msgText = `${match.homeTeam?.name} vs ${match.awayTeam?.name}`;
      const result = await sendMessage(friend.user_id, msgText, 'match_share', matchData);
      setMessages(prev =>
        prev.map(m => m.message_id === tempId
          ? { ...m, message_id: result.message_id, created_at: result.created_at, delivered: result.delivered }
          : m
        )
      );
    } catch (e) {
      setMessages(prev => prev.filter(m => m.message_id !== tempId));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [userId, friend.user_id]);

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

  const showPrivacy = privacy.read_receipts || privacy.delivery_status;

  return (
    <div className="flex flex-col h-full" data-testid="chat-panel">
      {/* Chat Header - Fixed */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0 z-10">
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
          <p className="text-sm font-semibold text-foreground truncate">{sanitizeDisplay(friend.nickname)}</p>
          <div className="flex items-center gap-1.5">
            {friend.is_online !== null && (
              <>
                <Circle className={`w-2.5 h-2.5 ${friend.is_online ? 'fill-emerald-500 text-emerald-500' : 'fill-zinc-400 text-zinc-400'}`} />
                <span className="text-[11px] text-muted-foreground">
                  {friend.is_online ? 'Online' : formatLastSeen(friend.last_seen)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area - Scrollable */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="messages-chat-messages px-4 py-3 space-y-0.5 scrollbar-hide relative"
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
            <p className="text-xs text-muted-foreground/60 mt-1">Say hello to {sanitizeDisplay(friend.nickname)}!</p>
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
                  privacy={showPrivacy}
                />
              )
            )}
            <div ref={messagesEndRef} />
          </>
        )}

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

      {/* Input Area - Fixed */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card/50 backdrop-blur-sm flex-shrink-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full flex-shrink-0 hover:bg-primary/10"
          onClick={() => setShowMatchModal(true)}
          data-testid="match-share-btn"
        >
          <Plus className="w-5 h-5" />
        </Button>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${sanitizeDisplay(friend.nickname)}...`}
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

      <MatchShareModal
        isOpen={showMatchModal}
        onClose={() => setShowMatchModal(false)}
        onSelect={handleShareMatch}
      />
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchConversations();
      setLoading(false);
    };
    if (isAuthenticated) load();
  }, [isAuthenticated, fetchConversations]);

  useEffect(() => {
    if (location.state?.openChat && !loading) {
      const friend = location.state.openChat;
      setActiveFriend(friend);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, loading]);

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
    <div className="h-screen bg-background flex flex-col overflow-hidden" data-testid="messages-page">
      <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      <main className="messages-layout flex-1 min-h-0">
        {/* Left Panel — Conversation list with independent scroll */}
        <div
          className={`w-full md:w-[340px] lg:w-[380px] flex-shrink-0 border-r border-border messages-sidebar bg-card/30 ${
            activeFriend ? 'hidden md:flex' : 'flex'
          }`}
          data-testid="conversations-sidebar"
        >
          {/* Sidebar header - Fixed */}
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

          {/* Conversation list - Scrollable */}
          <div className="messages-sidebar-list scrollbar-hide" data-testid="conversations-list">
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

        {/* Right Panel — Chat area with independent scroll */}
        <div
          className={`messages-chat-area ${
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
