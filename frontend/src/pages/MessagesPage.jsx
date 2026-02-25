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
  Check, CheckCheck, Plus, X, Trophy, Users
} from 'lucide-react';
import { MatchCard } from '@/components/home/MatchCard';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/* ─────── Sanitize ─────── */
function sanitizeDisplay(text) {
  if (!text) return '';
  return String(text);
}

/* ─────── Time helpers ─────── */
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
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

/* ─────── Message Status ─────── */
const MessageStatus = memo(({ delivered, read, isMine }) => {
  if (!isMine) return null;
  if (read) {
    return (
      <span className="msg-status-icon" data-testid="msg-status-read">
        <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
      </span>
    );
  }
  if (delivered) {
    return (
      <span className="msg-status-icon" data-testid="msg-status-delivered">
        <CheckCheck className="w-3.5 h-3.5 opacity-50" />
      </span>
    );
  }
  return (
    <span className="msg-status-icon" data-testid="msg-status-sent">
      <Check className="w-3.5 h-3.5 opacity-40" />
    </span>
  );
});
MessageStatus.displayName = 'MessageStatus';

/* ─────── Chat Match Card Wrapper (uses same MatchCard as Main Page) ─────── */
const ChatMatchCardWrapper = memo(({ matchData }) => {
  const { user } = useAuth();
  const [userVote, setUserVote] = useState(null);
  const [matchState, setMatchState] = useState(null);
  const [exactScorePrediction, setExactScorePrediction] = useState(null);

  const matchId = matchData?.match_id || matchData?.id;

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const matchRes = await fetch(`${API_URL}/api/football/match/${matchId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null);
        if (cancelled) return;

        const defaultVotes = { count: 0, percentage: 0 };
        const base = {
          id: matchId,
          homeTeam: matchData.homeTeam || { name: matchData.home_team || '' },
          awayTeam: matchData.awayTeam || { name: matchData.away_team || '' },
          dateTime: matchData.dateTime || '',
          competition: matchData.competition || '',
          sport: 'Football',
          status: matchData.status || 'SCHEDULED',
          score: matchData.score || {},
          votes: { home: { ...defaultVotes }, draw: { ...defaultVotes }, away: { ...defaultVotes } },
          totalVotes: 0,
          mostPicked: '-'
        };

        if (matchRes?.match) {
          const m = matchRes.match;
          base.homeTeam = m.homeTeam || base.homeTeam;
          base.awayTeam = m.awayTeam || base.awayTeam;
          base.dateTime = m.dateTime || base.dateTime;
          base.competition = m.competition || base.competition;
          base.status = m.status || base.status;
          base.score = m.score || base.score;
          base.votes = m.votes || base.votes;
          base.totalVotes = m.totalVotes || 0;
          base.mostPicked = m.mostPicked || '-';
        }

        setMatchState(base);

        if (user) {
          const [predRes, exactRes] = await Promise.all([
            fetch(`${API_URL}/api/predictions/match/${matchId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${API_URL}/api/predictions/exact-score/match/${matchId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
          ]);
          if (cancelled) return;
          if (predRes?.prediction) setUserVote(predRes.prediction);
          if (exactRes?.home_score !== undefined && exactRes?.home_score !== null) {
            setExactScorePrediction({ home_score: exactRes.home_score, away_score: exactRes.away_score });
          }
        }
      } catch (err) { console.error('ChatMatchCard load error:', err); }
    };

    load();
    return () => { cancelled = true; };
  }, [matchId, user, matchData]);

  const handleVote = async (mId, voteType) => {
    try {
      const res = await fetch(`${API_URL}/api/predictions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ match_id: mId, prediction: voteType }),
      });
      if (res.ok) setUserVote(voteType);
    } catch (err) { console.error('Vote failed:', err); }
  };

  const handleExactScoreSubmit = async (mId, homeScore, awayScore) => {
    const res = await fetch(`${API_URL}/api/predictions/exact-score`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ match_id: mId, home_score: homeScore, away_score: awayScore }),
    });
    if (res.ok) setExactScorePrediction({ home_score: homeScore, away_score: awayScore });
  };

  if (!matchState) {
    const homeName = matchData?.homeTeam?.name || matchData?.home_team || '';
    const awayName = matchData?.awayTeam?.name || matchData?.away_team || '';
    return (
      <div className="p-3 rounded-xl bg-card border border-border/30 animate-pulse" data-testid="shared-match-card">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Trophy className="w-3 h-3 text-amber-400" />
          <span>{matchData?.competition || 'Loading...'}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {matchData?.homeTeam?.crest && <img src={matchData.homeTeam.crest} alt="" className="w-5 h-5 object-contain" />}
            <span className="text-sm font-medium">{homeName}</span>
          </div>
          <div className="flex items-center gap-2">
            {matchData?.awayTeam?.crest && <img src={matchData.awayTeam.crest} alt="" className="w-5 h-5 object-contain" />}
            <span className="text-sm font-medium">{awayName}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="shared-match-card" onClick={(e) => e.stopPropagation()}>
      <MatchCard
        match={matchState}
        userVote={userVote}
        onVote={handleVote}
        onExactScoreSubmit={handleExactScoreSubmit}
        exactScorePrediction={exactScorePrediction}
        friendsOnMatch={[]}
        isAuthenticated={!!user}
      />
    </div>
  );
});
ChatMatchCardWrapper.displayName = 'ChatMatchCardWrapper';

/* ─────── Conversation Item ─────── */
const ConversationItem = memo(({ convo, isActive, onClick }) => {
  const initials = (convo.nickname || 'U').charAt(0).toUpperCase();
  const loadExisting = async () => {
    if (loaded || !matchId) return;
    try {
      const [predRes, exactRes] = await Promise.all([
        fetch(`${API_URL}/api/predictions/match/${matchId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_URL}/api/predictions/exact-score/match/${matchId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (predRes?.prediction) {
        setSavedPrediction(predRes.prediction);
        setSelectedVote(predRes.prediction);
      }
      if (exactRes?.home_score !== undefined && exactRes?.home_score !== null) {
        setExactScoreLocked(true);
        setHomeScoreInput(exactRes.home_score);
        setAwayScoreInput(exactRes.away_score);
      }
    } catch (err) { console.error('Load predictions failed:', err); }
    setLoaded(true);
  };

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) loadExisting();
  };

  // Save winner prediction (Guess It)
  const handleGuessIt = async () => {
    if (!selectedVote || !matchId || isLocked || exactScoreLocked) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ match_id: matchId, prediction: selectedVote }),
      });
      if (res.ok) setSavedPrediction(selectedVote);
    } catch (err) { console.error('Save prediction failed:', err); }
    finally { setIsSubmitting(false); }
  };

  // Lock exact score prediction
  const handleLockExactScore = async () => {
    if (!matchId || isLocked || savedPrediction) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/predictions/exact-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ match_id: matchId, home_score: homeScoreInput, away_score: awayScoreInput }),
      });
      if (res.ok) setExactScoreLocked(true);
    } catch (err) { console.error('Exact score failed:', err); }
    finally { setIsSubmitting(false); }
  };

  // Remove all predictions for this match
  const handleRemove = async () => {
    if (!matchId) return;
    setIsSubmitting(true);
    try {
      const promises = [];
      if (savedPrediction) {
        promises.push(fetch(`${API_URL}/api/predictions/match/${matchId}`, { method: 'DELETE', credentials: 'include' }));
      }
      if (exactScoreLocked) {
        promises.push(fetch(`${API_URL}/api/predictions/exact-score/match/${matchId}`, { method: 'DELETE', credentials: 'include' }));
      }
      await Promise.all(promises);
      setSavedPrediction(null);
      setSelectedVote(null);
      setExactScoreLocked(false);
      setHomeScoreInput(0);
      setAwayScoreInput(0);
      setShowAdvance(false);
    } catch (err) { console.error('Remove failed:', err); }
    finally { setIsSubmitting(false); }
  };

  const hasPrediction = !!savedPrediction || exactScoreLocked;
  const canRemove = hasPrediction || !!selectedVote;

  // Card background color
  const cardBg = isExpanded
    ? exactScoreLocked
      ? 'border-amber-500/30 bg-amber-500/[0.06] backdrop-blur-xl shadow-[0_0_30px_rgba(245,158,11,0.1)]'
      : savedPrediction
        ? 'border-emerald-500/30 bg-emerald-500/[0.06] backdrop-blur-xl shadow-[0_0_30px_rgba(34,197,94,0.1)]'
        : 'border-primary/20 bg-secondary/60 backdrop-blur-xl shadow-[0_0_20px_rgba(34,197,94,0.06)]'
    : exactScoreLocked
      ? 'border-amber-500/25 bg-amber-500/[0.04] backdrop-blur-sm hover:border-amber-500/40'
      : savedPrediction
        ? 'border-emerald-500/25 bg-emerald-500/[0.04] backdrop-blur-sm hover:border-emerald-500/40'
        : 'border-border/30 bg-card/40 backdrop-blur-sm hover:border-primary/20 hover:shadow-md hover:shadow-primary/[0.06]';

  const voteLabels = { home: '1', draw: 'X', away: '2' };

  return (
    <div
      className={`rounded-xl border transition-all duration-300 ease-out my-1 overflow-hidden ${cardBg}`}
      data-testid="shared-match-card"
    >
      {/* Header - always visible */}
      <div className="p-2.5 cursor-pointer" onClick={handleToggleExpand} data-testid="shared-match-card-toggle">
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy className="w-3 h-3 text-amber-400" />
          <span className={`text-[10px] font-semibold tracking-wide uppercase truncate ${isMine ? 'text-white/60' : 'text-muted-foreground'}`}>
            {sanitizeDisplay(matchData.competition)}
          </span>
          {matchData.status && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
              matchData.status === 'LIVE' || matchData.status === 'IN_PLAY' ? 'bg-red-500/20 text-red-400' :
              matchData.status === 'FINISHED' ? 'bg-white/10 text-white/50' :
              'bg-sky-500/15 text-sky-400'
            }`}>
              {matchData.status === 'LIVE' || matchData.status === 'IN_PLAY' ? 'LIVE' : matchData.status === 'FINISHED' ? 'FT' : 'Upcoming'}
            </span>
          )}
          {savedPrediction && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">PREDICTED</span>}
          {exactScoreLocked && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold">EXACT</span>}
          <span className={`ml-auto text-[9px] ${isExpanded ? 'text-primary' : isMine ? 'text-white/30' : 'text-muted-foreground/50'} transition-colors`}>
            {isExpanded ? 'Collapse' : 'Tap to expand'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {matchData.homeTeam?.crest && <img src={matchData.homeTeam.crest} alt="" className="w-4 h-4 rounded-full object-contain" />}
              <span className={`text-xs font-medium truncate ${isMine ? 'text-white/90' : 'text-foreground'}`}>{sanitizeDisplay(homeName)}</span>
            </div>
            <div className="flex items-center gap-2">
              {matchData.awayTeam?.crest && <img src={matchData.awayTeam.crest} alt="" className="w-4 h-4 rounded-full object-contain" />}
              <span className={`text-xs font-medium truncate ${isMine ? 'text-white/90' : 'text-foreground'}`}>{sanitizeDisplay(awayName)}</span>
            </div>
          </div>
          {matchData.score && matchData.score.home !== null && matchData.score.home !== undefined && (
            <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums flex-shrink-0">
              <span className={isMine ? 'text-white' : 'text-foreground'}>{matchData.score.home}</span>
              <span className={`text-xs ${isMine ? 'text-white/40' : 'text-muted-foreground'}`}>-</span>
              <span className={isMine ? 'text-white' : 'text-foreground'}>{matchData.score.away}</span>
            </div>
          )}
        </div>
        {matchData.dateTime && <p className={`text-[10px] mt-1.5 ${isMine ? 'text-white/40' : 'text-muted-foreground'}`}>{sanitizeDisplay(matchData.dateTime)}</p>}
      </div>

      {/* Expanded Section */}
      <div
        className={`transition-all duration-400 ease-out overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
        style={{ transitionProperty: 'max-height, opacity' }}
      >
        <div className="px-3 pb-3.5 space-y-3.5 border-t border-border/20 pt-3.5" onClick={(e) => e.stopPropagation()}>

          {isLocked ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              {matchData.status === 'FINISHED' ? 'This match has ended' : 'Match is live - predictions locked'}
            </p>
          ) : (
            <>
              {/* ── Vote Buttons (1/X/2) ── */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-muted-foreground">
                  Winner Prediction
                </p>
                <div className="flex gap-2.5">
                  {['home', 'draw', 'away'].map((type) => (
                    <button
                      key={type}
                      onClick={() => !exactScoreLocked && setSelectedVote(type)}
                      disabled={exactScoreLocked}
                      data-testid={`chat-vote-btn-${type}`}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
                        exactScoreLocked
                          ? 'opacity-40 cursor-not-allowed bg-secondary/20 border-border/20 text-muted-foreground'
                          : selectedVote === type
                            ? 'bg-primary/20 border-primary/50 text-primary shadow-[0_0_10px_rgba(34,197,94,0.15)]'
                            : 'bg-secondary/40 border-border/30 text-foreground hover:bg-secondary/60 hover:border-border/50'
                      }`}
                    >
                      <span className="text-sm">{voteLabels[type]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Guess It Button ── */}
              <button
                onClick={handleGuessIt}
                disabled={isSubmitting || exactScoreLocked || (!selectedVote && !savedPrediction)}
                data-testid="chat-guess-it-btn"
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
                  exactScoreLocked
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 cursor-not-allowed'
                    : savedPrediction
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : selectedVote
                        ? 'bg-primary hover:bg-primary/90 border-primary text-primary-foreground hover:scale-[1.01] active:scale-[0.99]'
                        : 'bg-secondary/30 border-border/30 text-muted-foreground opacity-50 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? '...' : exactScoreLocked ? 'Saved (Exact Score)' : savedPrediction ? 'Saved' : 'GUESS IT'}
              </button>

              {/* ── Action Buttons Row: Advance + Remove ── */}
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowAdvance(!showAdvance)}
                  disabled={savedPrediction}
                  data-testid="chat-advance-btn"
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-semibold transition-all duration-200 border ${
                    savedPrediction
                      ? 'opacity-40 cursor-not-allowed bg-secondary/20 border-border/20 text-muted-foreground'
                      : showAdvance
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-secondary/40 border-border/30 text-foreground hover:bg-secondary/60'
                  }`}
                >
                  {showAdvance ? 'Close Advance' : 'Advance'}
                </button>
                <button
                  onClick={handleRemove}
                  disabled={isSubmitting || !canRemove}
                  data-testid="chat-remove-btn"
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-semibold transition-all duration-200 border ${
                    canRemove
                      ? 'bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50'
                      : 'opacity-40 cursor-not-allowed bg-secondary/20 border-border/20 text-muted-foreground'
                  }`}
                >
                  Remove
                </button>
              </div>

              {/* ── Advance Section (Exact Score) ── */}
              <div className={`transition-all duration-300 overflow-hidden ${showAdvance && !savedPrediction ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Exact Score</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold">+50 PTS</span>
                  </div>

                  {exactScoreLocked ? (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-medium">
                        <span className="w-3.5 h-3.5 rounded-full bg-amber-500/20 flex items-center justify-center text-[8px]">&#10003;</span>
                        Exact Score Locked: {homeName} {homeScoreInput} - {awayScoreInput} {awayName}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-center">
                          <p className="text-[9px] text-muted-foreground mb-1 truncate">{homeName}</p>
                          <input
                            type="number" min="0" max="20" value={homeScoreInput}
                            onChange={(e) => setHomeScoreInput(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                            className="w-full h-9 text-center text-sm font-bold rounded-lg bg-secondary/50 border border-border/30 text-foreground focus:outline-none focus:border-amber-500/50"
                            data-testid="chat-exact-home"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-bold mt-4">-</span>
                        <div className="flex-1 text-center">
                          <p className="text-[9px] text-muted-foreground mb-1 truncate">{awayName}</p>
                          <input
                            type="number" min="0" max="20" value={awayScoreInput}
                            onChange={(e) => setAwayScoreInput(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                            className="w-full h-9 text-center text-sm font-bold rounded-lg bg-secondary/50 border border-border/30 text-foreground focus:outline-none focus:border-amber-500/50"
                            data-testid="chat-exact-away"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleLockExactScore}
                        disabled={isSubmitting}
                        data-testid="chat-lock-exact-btn"
                        className="w-full py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-all duration-200 disabled:opacity-50"
                      >
                        {isSubmitting ? '...' : 'Lock Exact Score Prediction'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Status footer */}
          {hasPrediction && !isLocked && (
            <div className="flex items-center gap-2 text-[10px] pt-1 border-t border-border/15">
              {savedPrediction && (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Pick: {selectedVote === 'home' ? '1' : selectedVote === 'draw' ? 'X' : '2'}
                </span>
              )}
              {exactScoreLocked && (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Exact: {homeScoreInput}-{awayScoreInput}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
SharedMatchCard.displayName = 'SharedMatchCard';

/* ─────── Conversation Item ─────── */
const ConversationItem = memo(({ convo, isActive, onClick }) => {
  const initials = (convo.nickname || 'U').charAt(0).toUpperCase();
  const picSrc = convo.picture?.startsWith('/') ? `${API_URL}${convo.picture}` : convo.picture;

  return (
    <button
      onClick={() => onClick(convo)}
      className={`w-full flex items-center gap-3 px-5 py-3 border-none cursor-pointer transition-colors duration-150 relative group ${
        isActive ? 'bg-primary/[0.08]' : 'bg-transparent hover:bg-secondary/40'
      }`}
      data-testid={`convo-item-${convo.user_id}`}
    >
      {isActive && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
      )}
      <div className="relative flex-shrink-0">
        <Avatar className="w-12 h-12 ring-2 ring-transparent group-hover:ring-border/30 transition-all duration-200">
          <AvatarImage src={picSrc} alt={convo.nickname} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        {convo.is_online !== null && (
          <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[2.5px] border-card transition-colors ${
            convo.is_online ? 'bg-emerald-500' : 'bg-zinc-500'
          }`} data-testid={`online-status-${convo.user_id}`} />
        )}
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-[13px] font-semibold truncate ${
            convo.unread_count > 0 ? 'text-foreground' : 'text-foreground/85'
          }`}>
            {sanitizeDisplay(convo.nickname)}
          </span>
          {convo.last_message?.created_at && (
            <span className={`text-[11px] flex-shrink-0 tabular-nums ${
              convo.unread_count > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'
            }`}>
              {formatConvoTime(convo.last_message.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[12px] truncate leading-relaxed ${
            convo.unread_count > 0 ? 'text-foreground/80 font-medium' : 'text-muted-foreground'
          }`}>
            {convo.last_message
              ? `${convo.last_message.is_mine ? 'You: ' : ''}${sanitizeDisplay(convo.last_message.message)}`
              : 'Start a conversation'}
          </p>
          {convo.unread_count > 0 && (
            <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none" data-testid={`unread-badge-${convo.user_id}`}>
              {convo.unread_count > 99 ? '99+' : convo.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
ConversationItem.displayName = 'ConversationItem';

/* ─────── Message Bubble ─────── */
const MessageBubble = memo(({ msg, isMine, privacy, showAvatar, friendPic, friendInitial }) => {
  const isMatchShare = msg.message_type === 'match_share';

  return (
    <div className={`flex items-end gap-2 ${isMine ? 'justify-end pl-12' : 'justify-start pr-12'} py-[1px]`}>
      {!isMine && showAvatar && (
        <Avatar className="w-7 h-7 flex-shrink-0 mb-1">
          <AvatarImage src={friendPic} />
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
            {friendInitial}
          </AvatarFallback>
        </Avatar>
      )}
      {!isMine && !showAvatar && <div className="w-7 flex-shrink-0" />}

      <div
        className={`max-w-[75%] sm:max-w-[85%] px-3.5 py-2 relative break-words ${
          isMine
            ? 'bg-primary text-white rounded-[1.125rem] rounded-br-[0.375rem]'
            : 'bg-secondary text-foreground rounded-[1.125rem] rounded-bl-[0.375rem] border border-border/30'
        }`}
        data-testid={`message-bubble-${msg.message_id}`}
      >
        {isMatchShare && msg.match_data ? (
          <SharedMatchCard matchData={msg.match_data} isMine={isMine} />
        ) : (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
            {sanitizeDisplay(msg.message)}
          </p>
        )}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className={`text-[10px] tabular-nums ${isMine ? 'text-white/50' : 'text-muted-foreground/70'}`}>
            {formatTime(msg.created_at)}
          </span>
          {isMine && privacy && (
            <MessageStatus delivered={msg.delivered} read={msg.read} isMine={true} />
          )}
        </div>
      </div>
    </div>
  );
});
MessageBubble.displayName = 'MessageBubble';

/* ─────── Date Separator ─────── */
const DateSeparator = memo(({ date }) => (
  <div className="flex items-center gap-4 my-5 px-2">
    <div className="flex-1 h-px bg-border/30" />
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3.5 py-1 rounded-full bg-secondary/60 whitespace-nowrap">{date}</span>
    <div className="flex-1 h-px bg-border/30" />
  </div>
));
DateSeparator.displayName = 'DateSeparator';

/* ─────── Match Share Modal ─────── */
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
            className="pl-9 h-9 text-sm bg-secondary/50 border-border/50"
            data-testid="match-share-search"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0 scrollbar-hide" data-testid="match-share-list">
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
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-secondary/60 border border-transparent hover:border-border/40 transition-all duration-150"
                data-testid={`match-share-item-${match.id}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-muted-foreground truncate">{match.competition}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    match.status === 'LIVE' ? 'bg-red-500/20 text-red-400' :
                    match.status === 'FINISHED' ? 'bg-muted text-muted-foreground' :
                    'bg-sky-500/15 text-sky-400'
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
                    <div className="flex items-center gap-1.5 mt-0.5">
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

/* ─────── Chat Panel ─────── */
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
  const friendInitial = (friend.nickname || 'U').charAt(0).toUpperCase();

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
          if (data.messages?.some(m => m.sender_id === friend.user_id && !m.read)) {
            const unreadCount = data.messages.filter(m => m.sender_id === friend.user_id && !m.read).length;
            markMessagesRead(friend.user_id);
            markConversationRead(friend.user_id, unreadCount);
          }
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

  // Scroll to bottom
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

  // Scroll indicator
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
  }, []);

  // Send text
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      message_id: tempId, sender_id: userId, receiver_id: friend.user_id,
      message: text, message_type: 'text',
      created_at: new Date().toISOString(), delivered: false, read: false
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
      score: match.score || {}, status: match.status,
      dateTime: match.dateTime, competition: match.competition
    };

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      message_id: tempId, sender_id: userId, receiver_id: friend.user_id,
      message: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
      message_type: 'match_share', match_data: matchData,
      created_at: new Date().toISOString(), delivered: false, read: false
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  // Group messages by date + track consecutive sender
  const groupedMessages = [];
  let lastDate = '';
  let lastSender = '';
  for (const msg of messages) {
    const dateStr = formatDateSeparator(msg.created_at);
    if (dateStr !== lastDate) {
      groupedMessages.push({ type: 'date', date: dateStr, key: `date-${msg.created_at}` });
      lastDate = dateStr;
      lastSender = '';
    }
    const showAvatar = msg.sender_id !== lastSender;
    groupedMessages.push({ type: 'msg', msg, key: msg.message_id, showAvatar });
    lastSender = msg.sender_id;
  }

  const showPrivacy = privacy.read_receipts || privacy.delivery_status;

  return (
    <div className="flex flex-col h-full" data-testid="chat-panel">
      {/* ── Chat Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-2.5 border-b border-border/30 bg-card/60 backdrop-blur-xl z-10" data-testid="chat-header">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden rounded-full flex-shrink-0 h-9 w-9 hover:bg-secondary/80"
          onClick={onBack}
          data-testid="chat-back-btn"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="relative flex-shrink-0">
          <Avatar className="w-10 h-10">
            <AvatarImage src={picSrc} alt={friend.nickname} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {friendInitial}
            </AvatarFallback>
          </Avatar>
          {friend.is_online && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {sanitizeDisplay(friend.nickname)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            {friend.is_online ? (
              <span className="text-emerald-500 font-medium">Online</span>
            ) : (
              <span>Last seen {formatLastSeen(friend.last_seen)}</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide relative"
        style={{ background: 'var(--background, hsl(var(--background)))' }}
        data-testid="messages-area"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary/60" />
              <span className="text-xs text-muted-foreground">Loading messages...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-primary/40" />
            </div>
            <p className="text-sm font-medium text-foreground/60">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[200px]">
              Send a message to start chatting with {sanitizeDisplay(friend.nickname)}
            </p>
          </div>
        ) : (
          <div className="py-4 px-3 sm:px-5 space-y-1">
            {groupedMessages.map(item =>
              item.type === 'date' ? (
                <DateSeparator key={item.key} date={item.date} />
              ) : (
                <MessageBubble
                  key={item.key}
                  msg={item.msg}
                  isMine={item.msg.sender_id === userId}
                  privacy={showPrivacy}
                  showAvatar={item.showAvatar}
                  friendPic={picSrc}
                  friendInitial={friendInitial}
                />
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {showScrollDown && (
          <button
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-none cursor-pointer shadow-lg shadow-primary/30 hover:-translate-x-1/2 hover:scale-[1.08] hover:shadow-xl hover:shadow-primary/40 transition-all duration-150 z-[5]"
            data-testid="scroll-down-btn"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Input Area ── */}
      <div className="shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2.5 md:py-3 border-t border-border/30 bg-card/60 backdrop-blur-xl z-10" data-testid="chat-input-bar">
        <button
          onClick={() => setShowMatchModal(true)}
          className="shrink-0 w-[38px] h-[38px] rounded-full border-none bg-secondary/70 text-muted-foreground flex items-center justify-center cursor-pointer hover:bg-primary/15 hover:text-primary hover:scale-105 transition-all duration-150"
          data-testid="match-share-btn"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Type a message...`}
            className="w-full h-10 px-4 rounded-[1.25rem] border border-border/40 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:bg-secondary/80 focus:ring-[3px] focus:ring-primary/[0.06] transition-all duration-200"
            maxLength={2000}
            data-testid="chat-input"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="shrink-0 w-10 h-10 rounded-full border-none bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:scale-[1.06] hover:shadow-lg active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-150"
          data-testid="chat-send-btn"
        >
          {sending ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Send className="w-[18px] h-[18px]" />}
        </button>
      </div>

      <MatchShareModal
        isOpen={showMatchModal}
        onClose={() => setShowMatchModal(false)}
        onSelect={handleShareMatch}
      />
    </div>
  );
};

/* ═══════════ Main Messages Page ═══════════ */
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

      <main className="flex flex-row w-full flex-1 min-h-0 overflow-hidden">
        {/* ═══ Left Panel — Conversations ═══ */}
        <aside
          className={`flex flex-col h-full overflow-hidden border-r border-border/60 bg-card/50 shrink-0 ${
            activeFriend ? 'hidden md:flex' : 'flex'
          } w-full md:w-[360px] lg:w-[400px]`}
          data-testid="conversations-sidebar"
        >
          {/* Sidebar Header */}
          <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border/30 bg-card/40">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-foreground tracking-tight">Messages</h1>
              <span className="text-xs text-muted-foreground tabular-nums">
                {conversations.length > 0 && `${conversations.length} chat${conversations.length > 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-9 rounded-full border border-border/40 bg-secondary/50 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:bg-secondary/80 focus:ring-[3px] focus:ring-primary/[0.08] transition-all duration-200"
                data-testid="convo-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide" data-testid="conversations-list">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
                <span className="text-xs text-muted-foreground mt-3">Loading chats...</span>
              </div>
            ) : filteredConvos.length > 0 ? (
              <div className="py-1">
                {filteredConvos.map(convo => (
                  <ConversationItem
                    key={convo.user_id}
                    convo={convo}
                    isActive={activeFriend?.user_id === convo.user_id}
                    onClick={handleSelectConvo}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
                <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                  {searchQuery ? (
                    <Search className="w-7 h-7 text-muted-foreground/30" />
                  ) : (
                    <Users className="w-7 h-7 text-muted-foreground/30" />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground/60">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[220px]">
                  {searchQuery ? 'Try a different name' : 'Add friends to start chatting!'}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 rounded-full px-5"
                    onClick={() => navigate('/friends')}
                    data-testid="find-friends-btn"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Find Friends
                  </Button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ═══ Right Panel — Chat Area ═══ */}
        <section
          className={`flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden bg-background ${
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
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/8 to-primary/3 flex items-center justify-center mb-5">
                <MessageSquare className="w-10 h-10 text-primary/30" />
              </div>
              <h2 className="text-lg font-semibold text-foreground/60 mb-1.5">
                Select a conversation
              </h2>
              <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
                Choose a friend from the list to start chatting
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default MessagesPage;
