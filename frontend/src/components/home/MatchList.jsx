import { useState, useCallback, memo, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, Loader2, Check, AlertCircle, RefreshCw, Trash2, Sparkles, Lock, Radio, Heart, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { savePrediction, deletePrediction } from '@/services/predictions';
import { addFavoriteClub, removeFavoriteClub } from '@/services/favorites';
import { addFavoriteMatch, removeFavoriteMatch } from '@/services/messages';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

// ============ Status Badge ============
const StatusBadge = memo(({ status, statusDetail }) => {
  if (status === 'LIVE') {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30"
          data-testid="live-badge"
        >
          <Radio className="w-3 h-3 live-pulse-icon" />
          {statusDetail === 'HT' ? 'Half Time' : 'Live'}
        </span>
      </div>
    );
  }
  if (status === 'FINISHED') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-muted text-muted-foreground border border-border"
        data-testid="ft-badge"
      >
        FT
      </span>
    );
  }
  return null;
});
StatusBadge.displayName = 'StatusBadge';

// ============ Score Display ============
const ScoreDisplay = memo(({ score, status, prevScore, matchMinute }) => {
  const homeChanged = prevScore && prevScore.home !== score.home;
  const awayChanged = prevScore && prevScore.away !== score.away;
  const isLive = status === 'LIVE';
  const hasScore = status !== 'NOT_STARTED' && !(score.home === null && score.away === null);

  return (
    <div className={`${hasScore ? 'score-block' : 'px-2'} flex flex-col items-center justify-center flex-shrink-0`} data-testid="score-display">
      {/* Match minute above score for LIVE matches */}
      {isLive && matchMinute ? (
        <span className="text-[11px] font-semibold text-red-400 tabular-nums mb-0.5" data-testid="score-minute">
          {matchMinute}
        </span>
      ) : hasScore ? (
        /* Invisible placeholder to keep vertical alignment consistent */
        <span className="text-[11px] mb-0.5 invisible">00'</span>
      ) : null}
      {hasScore ? (
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xl font-bold tabular-nums transition-all duration-500 ${
              homeChanged ? 'text-primary scale-110' : 'text-foreground'
            }`}
          >
            {score.home ?? 0}
          </span>
          <span className="text-sm text-muted-foreground font-medium">-</span>
          <span
            className={`text-xl font-bold tabular-nums transition-all duration-500 ${
              awayChanged ? 'text-primary scale-110' : 'text-foreground'
            }`}
          >
            {score.away ?? 0}
          </span>
        </div>
      ) : (
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">vs</span>
      )}
    </div>
  );
});
ScoreDisplay.displayName = 'ScoreDisplay';

// ============ Prediction Locked Indicator ============
const PredictionLockedBanner = memo(({ lockReason }) => (
  <div
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium"
    data-testid="prediction-locked"
  >
    <Lock className="w-3 h-3" />
    <span>{lockReason || 'Prediction closed'}</span>
  </div>
));
PredictionLockedBanner.displayName = 'PredictionLockedBanner';

// ============ Team Crest Image ============
const TeamCrest = memo(({ team }) => {
  if (team.crest) {
    return (
      <img
        src={team.crest}
        alt={team.name}
        className="w-6 h-6 md:w-7 md:h-7 rounded-full object-contain bg-secondary flex-shrink-0"
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  }
  return (
    <div className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full bg-secondary text-sm md:text-base flex-shrink-0">
      {team.flag || team.logo || ''}
    </div>
  );
});
TeamCrest.displayName = 'TeamCrest';

// ============ Favorite Heart Button ============
const FavoriteHeart = memo(({ teamId, teamName, teamCrest, isFavorite, onToggle, isAuthenticated }) => {
  const [animating, setAnimating] = useState(false);
  const [optimisticFavorite, setOptimisticFavorite] = useState(null);

  // Reset optimistic state when prop changes
  useEffect(() => {
    setOptimisticFavorite(null);
  }, [isFavorite]);

  if (!isAuthenticated) return null;

  const displayFavorite = optimisticFavorite !== null ? optimisticFavorite : isFavorite;

  const handleClick = (e) => {
    e.stopPropagation();
    const newState = !displayFavorite;
    
    // Immediate visual feedback
    setOptimisticFavorite(newState);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 200);
    
    // Fire and forget - API call in background
    onToggle(teamId, teamName, teamCrest, newState).catch(() => {
      // Revert on error
      setOptimisticFavorite(!newState);
    });
  };

  return (
    <button
      onClick={handleClick}
      className="flex-shrink-0 p-0.5 rounded-full hover:bg-muted/50 active:scale-90 transition-all duration-100"
      data-testid={`fav-heart-${teamId}`}
      aria-label={displayFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        className={`w-3.5 h-3.5 transition-all duration-100 ${
          displayFavorite
            ? 'text-red-500 fill-red-500'
            : 'text-muted-foreground/40 hover:text-red-400'
        } ${animating ? 'scale-125' : 'scale-100'}`}
      />
    </button>
  );
});
FavoriteHeart.displayName = 'FavoriteHeart';

// ============ Bookmark Match Button ============
const BookmarkMatch = memo(({ match, isBookmarked, onToggle, isAuthenticated }) => {
  const [animating, setAnimating] = useState(false);
  const [optimisticBookmark, setOptimisticBookmark] = useState(null);

  // Reset optimistic state when prop changes
  useEffect(() => {
    setOptimisticBookmark(null);
  }, [isBookmarked]);

  if (!isAuthenticated) return null;

  const displayBookmark = optimisticBookmark !== null ? optimisticBookmark : isBookmarked;

  const handleClick = (e) => {
    e.stopPropagation();
    const newState = !displayBookmark;
    
    // Immediate visual feedback
    setOptimisticBookmark(newState);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 200);
    
    // Fire and forget - API call in background
    onToggle(match, newState).catch(() => {
      // Revert on error
      setOptimisticBookmark(!newState);
    });
  };

  return (
    <button
      onClick={handleClick}
      className="flex-shrink-0 p-1 rounded-md hover:bg-muted/50 active:scale-90 transition-all duration-100"
      data-testid={`bookmark-match-${match.id}`}
      aria-label={displayBookmark ? 'Remove from favorite matches' : 'Add to favorite matches'}
    >
      <Bookmark
        className={`w-4 h-4 transition-all duration-100 ${
          displayBookmark
            ? 'text-amber-500 fill-amber-500'
            : 'text-muted-foreground/40 hover:text-amber-400'
        } ${animating ? 'scale-125' : 'scale-100'}`}
      />
    </button>
  );
});
BookmarkMatch.displayName = 'BookmarkMatch';

// ============ Vote Button ============
const VoteButton = memo(({ type, votes, percentage, isSelected, onClick, disabled, locked }) => {
  const labels = { home: '1', draw: 'X', away: '2' };
  const isLocked = disabled || locked;

  const handleClick = () => {
    if (!isLocked) {
      onClick(type);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLocked}
      data-selected={isSelected ? 'true' : 'false'}
      data-testid={`vote-btn-${type}`}
      className={`flex flex-col items-center justify-center match-vote-btn px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 rounded-lg border ${
        isLocked
          ? 'opacity-40 cursor-not-allowed bg-muted border-border/30'
          : isSelected
            ? 'bg-primary/30 border-primary border-2 shadow-glow ring-2 ring-primary/30'
            : 'bg-vote-inactive border-transparent hover:bg-vote-inactive-hover hover:border-border cursor-pointer active:scale-95'
      }`}
      style={{ transition: 'background-color 0.1s ease, border-color 0.1s ease, box-shadow 0.1s ease, transform 0.1s ease' }}
    >
      <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5">
        <span className={`text-xs sm:text-sm md:text-base font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
          {labels[type]}
        </span>
        {isSelected && !isLocked && (
          <span className="flex items-center justify-center w-3 h-3 sm:w-4 sm:h-4 rounded bg-primary/20">
            <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3 text-primary" />
          </span>
        )}
      </div>
      <span className="text-xs sm:text-sm md:text-base font-bold text-foreground">{votes.toLocaleString()}</span>
      <span className={`text-[10px] sm:text-xs md:text-sm ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
        {percentage}%
      </span>
    </button>
  );
});
VoteButton.displayName = 'VoteButton';

// ============ GUESS IT Button ============
const GuessItButton = memo(({ currentSelection, savedPrediction, isLoading, onClick, locked, hasExactScore }) => {
  const hasSelection = !!currentSelection;
  const hasSaved = !!savedPrediction;
  const isCurrentSaved = hasSaved && savedPrediction === currentSelection;
  const hasUnsavedChanges = hasSaved && currentSelection && savedPrediction !== currentSelection;
  // Mutual exclusivity: if exact score is locked, show saved-orange state
  const blockedByExactScore = hasExactScore && !hasSaved;

  const getButtonState = () => {
    if (locked) return { text: 'Closed', showCheck: false, showUpdate: false, isSaved: false, isLocked: true, isExactScore: false };
    if (isLoading) return { text: 'Saving...', showCheck: false, showUpdate: false, isSaved: false, isLocked: false, isExactScore: false };
    if (blockedByExactScore) return { text: 'Saved', showCheck: true, showUpdate: false, isSaved: true, isLocked: false, isExactScore: true };
    if (isCurrentSaved && hasExactScore) return { text: 'Saved', showCheck: true, showUpdate: false, isSaved: true, isLocked: false, isExactScore: true };
    if (isCurrentSaved) return { text: 'Saved', showCheck: true, showUpdate: false, isSaved: true, isLocked: false, isExactScore: false };
    if (hasUnsavedChanges) return { text: 'Update', showCheck: false, showUpdate: true, isSaved: false, isLocked: false, isExactScore: false };
    return { text: 'GUESS IT', showCheck: false, showUpdate: false, isSaved: false, isLocked: false, isExactScore: false };
  };

  const state = getButtonState();
  // Disabled when: locked, no selection (and no exact score), loading, OR exact score blocks voting
  const isDisabled = locked || isLoading || blockedByExactScore || (!hasSelection && !hasSaved);

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      data-testid="guess-it-btn"
      className={`
        relative match-action-btn h-[56px] sm:h-[72px] md:h-[84px] rounded-xl font-bold text-xs sm:text-sm md:text-base
        ${state.isLocked
          ? 'bg-muted border-2 border-border text-muted-foreground cursor-not-allowed'
          : state.isSaved
            ? state.isExactScore
              ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-500'
              : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary/30'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
        }
        ${isDisabled && !state.isSaved && !state.isLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
      `}
      style={{ transition: 'background-color 0.1s ease, transform 0.1s ease, box-shadow 0.1s ease' }}
    >
      <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1">
        {state.isLocked ? (
          <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : isLoading ? (
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
        ) : state.showCheck ? (
          <Check className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : state.showUpdate ? (
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <span className="text-base sm:text-lg font-bold">G</span>
        )}
        <span className="text-[10px] sm:text-xs md:text-sm font-semibold">{state.text}</span>
      </div>
    </Button>
  );
});
GuessItButton.displayName = 'GuessItButton';

// ============ Remove Button ============
const RemoveButton = memo(({ onClick, disabled, hasSelection, hasExactScore }) => {
  const canRemove = hasSelection || hasExactScore;
  return (
    <Button
      onClick={onClick}
      disabled={disabled || !canRemove}
      variant="outline"
      data-testid="remove-prediction-btn"
      className={`
        relative match-action-btn-sm h-[56px] sm:h-[72px] md:h-[84px] rounded-xl font-bold text-xs sm:text-sm md:text-base
        border-2 border-muted-foreground/30 hover:border-destructive/50
        bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive
        ${!canRemove ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
      `}
      style={{ transition: 'background-color 0.15s ease, transform 0.15s ease, border-color 0.15s ease' }}
    >
      <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1">
        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-[10px] sm:text-xs md:text-sm font-semibold">Remove</span>
      </div>
    </Button>
  );
});
RemoveButton.displayName = 'RemoveButton';

// ============ Advance Button ============
const AdvanceButton = memo(({ onClick, disabled }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    variant="outline"
    data-testid="advance-prediction-btn"
    className={`
      relative match-action-btn-sm h-[56px] sm:h-[72px] md:h-[84px] rounded-xl font-bold text-xs sm:text-sm md:text-base
      border-2 border-amber-500/30 hover:border-amber-500
      bg-gradient-to-br from-amber-500/5 to-orange-500/10 
      hover:from-amber-500/20 hover:to-orange-500/20
      text-amber-600 dark:text-amber-400
      hover:scale-105 hover:shadow-lg hover:shadow-amber-500/20
    `}
    style={{ transition: 'background-color 0.15s ease, transform 0.15s ease, border-color 0.15s ease' }}
  >
    <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1">
      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="text-[10px] sm:text-xs md:text-sm font-semibold">Advance</span>
    </div>
  </Button>
));
AdvanceButton.displayName = 'AdvanceButton';

// ============ Advanced Options Modal ============
import { Target, Lightbulb, UserPlus, Users, ChevronRight, X as XIcon, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { saveExactScorePrediction, getExactScorePrediction, getMyExactScorePredictions } from '@/services/predictions';
import { useFriends } from '@/lib/FriendsContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdvancedOptionsModal = memo(({ isOpen, onClose, match, isAuthenticated, onNavigateLogin, onExactScoreSaved, savedPrediction }) => {
  const [activeSection, setActiveSection] = useState('exact-score');
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingPrediction, setExistingPrediction] = useState(null);
  const [smartAdvice, setSmartAdvice] = useState(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [invitingFriend, setInvitingFriend] = useState(null);
  const [invitedFriends, setInvitedFriends] = useState(new Set());
  const [friendsActivity, setFriendsActivity] = useState([]);
  const [isLoadingFriendsActivity, setIsLoadingFriendsActivity] = useState(false);
  
  // Get friends list from context
  const { friends } = useFriends();

  // Load existing exact score prediction
  useEffect(() => {
    if (isOpen && isAuthenticated && match) {
      getExactScorePrediction(match.id)
        .then(pred => {
          if (pred) {
            setExistingPrediction(pred);
            setHomeScore(pred.home_score);
            setAwayScore(pred.away_score);
          }
        })
        .catch(() => {});
      
      // Reset invites when modal opens
      setInvitedFriends(new Set());
    }
  }, [isOpen, isAuthenticated, match]);
  
  // Load friends activity for this match
  useEffect(() => {
    if (isOpen && isAuthenticated && match && activeSection === 'friends') {
      setIsLoadingFriendsActivity(true);
      fetch(`${API_URL}/api/predictions/match/${match.id}/friends-activity`, {
        credentials: 'include'
      })
        .then(res => res.ok ? res.json() : { friends: [] })
        .then(data => setFriendsActivity(data.friends || []))
        .catch(() => setFriendsActivity([]))
        .finally(() => setIsLoadingFriendsActivity(false));
    }
  }, [isOpen, isAuthenticated, match, activeSection]);

  const handleExactScoreSubmit = async () => {
    if (!isAuthenticated) {
      onNavigateLogin();
      return;
    }
    setIsSubmitting(true);
    try {
      await saveExactScorePrediction(match.id, homeScore, awayScore);
      setExistingPrediction({ home_score: homeScore, away_score: awayScore });
      if (onExactScoreSaved) onExactScoreSaved(match.id);
      toast.success('Exact score prediction saved!', {
        description: `${match.homeTeam.name} ${homeScore} - ${awayScore} ${match.awayTeam.name}`,
        duration: 3000
      });
    } catch (error) {
      toast.error('Failed to save prediction', { description: error.message, duration: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGetAdvice = async () => {
    setIsLoadingAdvice(true);
    try {
      const response = await fetch(`${API_URL}/api/predictions/smart-advice/${match.id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Use advice if available, otherwise use the message or a default
        setSmartAdvice(data.advice || data.message || "No top performers have predicted this match yet. Trust your instincts!");
      } else {
        setSmartAdvice("No advice available for this match yet. Top performers haven't predicted yet.");
      }
    } catch {
      setSmartAdvice("Unable to get advice at this time. Please try again.");
    } finally {
      setIsLoadingAdvice(false);
    }
  };
  
  const handleInviteFriend = async (friend) => {
    if (invitedFriends.has(friend.user_id)) {
      toast.info('Already invited', { description: `You've already invited ${friend.nickname}` });
      return;
    }
    
    setInvitingFriend(friend.user_id);
    try {
      const response = await fetch(`${API_URL}/api/friends/invite/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          friend_user_id: friend.user_id,
          match_id: match.id,
          home_team: match.homeTeam.name,
          away_team: match.awayTeam.name,
          match_date: match.dateTime || match.utcDate,
          match_card: {
            match_id: match.id,
            homeTeam: { name: match.homeTeam?.name, crest: match.homeTeam?.crest || match.homeTeam?.logo },
            awayTeam: { name: match.awayTeam?.name, crest: match.awayTeam?.crest || match.awayTeam?.logo },
            competition: match.competition || '',
            dateTime: match.dateTime || '',
            status: match.status || 'NOT_STARTED',
            score: match.score || {}
          }
        })
      });
      
      if (response.ok) {
        setInvitedFriends(prev => new Set([...prev, friend.user_id]));
        toast.success('Invitation sent!', {
          description: `${friend.nickname} will receive a notification`,
          duration: 3000
        });
      } else {
        const error = await response.json();
        toast.error('Failed to invite', { description: error.detail || 'Please try again' });
      }
    } catch {
      toast.error('Failed to send invitation');
    } finally {
      setInvitingFriend(null);
    }
  };

  if (!match) return null;

  const sections = [
    { id: 'exact-score', label: 'Exact Score', icon: Target, color: 'amber' },
    { id: 'smart-advice', label: 'Smart Advice', icon: Lightbulb, color: 'sky' },
    { id: 'invite', label: 'Invite Friend', icon: UserPlus, color: 'emerald' },
    { id: 'friends', label: 'Friends Activity', icon: Users, color: 'purple' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <div className="bg-card">
          {/* Header */}
          <div className="p-4 border-b border-border/50">
            <DialogTitle className="text-lg font-bold">Advanced Options</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </DialogDescription>
          </div>

          {/* Section Tabs */}
          <div className="flex border-b border-border/30 overflow-x-auto">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => !section.disabled && setActiveSection(section.id)}
                disabled={section.disabled}
                className={`flex-1 min-w-[100px] px-3 py-2.5 text-xs font-medium transition-all border-b-2 ${
                  activeSection === section.id
                    ? `border-${section.color}-500 text-${section.color}-500 bg-${section.color}-500/5`
                    : section.disabled
                      ? 'border-transparent text-muted-foreground/50 cursor-not-allowed'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <section.icon className="w-4 h-4 mx-auto mb-1" />
                {section.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 min-h-[200px]">
            {!isAuthenticated ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">Please sign in to access advanced features</p>
                <Button onClick={onNavigateLogin}>Sign In</Button>
              </div>
            ) : activeSection === 'exact-score' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold">Predict Exact Score</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">
                    +50 BONUS
                  </span>
                </div>
                
                {savedPrediction ? (
                  <div className="p-4 rounded-lg bg-muted/50 border border-border/30">
                    <div className="flex items-center gap-2 text-muted-foreground font-medium">
                      <Lock className="w-4 h-4" />
                      Exact Score Unavailable
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      You already saved a winner prediction (1/X/2) for this match. Remove it first to use exact score.
                    </p>
                  </div>
                ) : existingPrediction ? (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-amber-500 font-medium">
                      <Check className="w-4 h-4" />
                      Exact Score Saved
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Your prediction: {match.homeTeam.name} <strong>{existingPrediction.home_score}</strong> - <strong>{existingPrediction.away_score}</strong> {match.awayTeam.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      You can edit this prediction from the <strong>My Predictions</strong> page before the match starts.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 text-center">
                        <label className="text-xs text-muted-foreground block mb-1 truncate">{match.homeTeam.name}</label>
                        <Input
                          type="number"
                          min="0"
                          max="20"
                          value={homeScore}
                          onChange={e => setHomeScore(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                          className="h-12 text-xl font-bold text-center"
                          data-testid="modal-exact-home"
                        />
                      </div>
                      <span className="text-2xl font-bold text-muted-foreground pt-5">-</span>
                      <div className="flex-1 text-center">
                        <label className="text-xs text-muted-foreground block mb-1 truncate">{match.awayTeam.name}</label>
                        <Input
                          type="number"
                          min="0"
                          max="20"
                          value={awayScore}
                          onChange={e => setAwayScore(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                          className="h-12 text-xl font-bold text-center"
                          data-testid="modal-exact-away"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handleExactScoreSubmit}
                      disabled={isSubmitting}
                      className="w-full gap-2"
                    >
                      <Target className="w-4 h-4" />
                      {isSubmitting ? 'Submitting...' : 'Guess Exact Score'}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      You can edit your exact score prediction before the match starts.
                    </p>
                  </>
                )}
              </div>
            ) : activeSection === 'smart-advice' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-sky-500" />
                  <span className="font-semibold">Smart Advice</span>
                </div>
                {smartAdvice ? (
                  <div className="p-4 rounded-lg bg-sky-500/10 border border-sky-500/20">
                    <p className="text-sm">{smartAdvice}</p>
                  </div>
                ) : (
                  <Button 
                    onClick={handleGetAdvice}
                    variant="outline"
                    disabled={isLoadingAdvice}
                    className="w-full gap-2"
                  >
                    <Lightbulb className="w-4 h-4" />
                    {isLoadingAdvice ? 'Getting advice...' : 'Get Smart Advice'}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Get prediction advice from top-performing users who have a high accuracy rate.
                </p>
              </div>
            ) : activeSection === 'invite' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-500" />
                  <span className="font-semibold">Invite Friend to Predict</span>
                </div>
                
                {friends && friends.length > 0 ? (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {friends.map(friend => (
                      <div 
                        key={friend.user_id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          {friend.picture ? (
                            <img src={friend.picture} alt={friend.nickname} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                              {(friend.nickname || '?')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{friend.nickname}</p>
                          <p className="text-xs text-muted-foreground">Level {friend.level}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={invitedFriends.has(friend.user_id) ? "secondary" : "default"}
                          disabled={invitingFriend === friend.user_id || invitedFriends.has(friend.user_id)}
                          onClick={() => handleInviteFriend(friend)}
                          className="gap-1.5"
                          data-testid={`invite-friend-${friend.user_id}`}
                        >
                          {invitedFriends.has(friend.user_id) ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Invited
                            </>
                          ) : invitingFriend === friend.user_id ? (
                            <>Sending...</>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
                              Invite
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No friends yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Add friends to invite them to predict!</p>
                  </div>
                )}
                
                <p className="text-[10px] text-muted-foreground text-center">
                  Friends will receive a notification and chat message with match details.
                </p>
              </div>
            ) : activeSection === 'friends' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  <span className="font-semibold">Friends Activity</span>
                </div>
                
                {isLoadingFriendsActivity ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : friendsActivity && friendsActivity.length > 0 ? (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {friendsActivity.map((activity, idx) => (
                      <div 
                        key={activity.user_id || idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          {activity.picture ? (
                            <img src={activity.picture} alt={activity.nickname} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                              {(activity.nickname || '?')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.nickname}</p>
                          <p className="text-xs text-muted-foreground">
                            Predicted: <span className="font-medium text-purple-500">
                              {activity.prediction === 'home' ? '1 (Home)' : activity.prediction === 'away' ? '2 (Away)' : 'X (Draw)'}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No friends have predicted yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Invite friends to see their predictions!</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
AdvancedOptionsModal.displayName = 'AdvancedOptionsModal';

// ============ Auth Required Modal ============
const AuthRequiredModal = memo(({ isOpen, onClose, onLogin, onRegister }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-primary" />
          </div>
        </div>
        <DialogTitle className="text-xl font-bold text-center">Sign In Required</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          Please login or register to save your prediction.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3 mt-4">
        <Button className="w-full bg-primary hover:bg-primary/90" onClick={onLogin}>
          Sign In
        </Button>
        <Button variant="outline" className="w-full" onClick={onRegister}>
          Create Account
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </DialogContent>
  </Dialog>
));
AuthRequiredModal.displayName = 'AuthRequiredModal';

// ============ Match Row (Memoized - renders BOTH layouts, CSS controls visibility) ============
const MatchRow = memo(({
  match,
  currentSelection,
  savedPrediction,
  onSelectPrediction,
  onGuessIt,
  onRefresh,
  onAdvance,
  isLoading,
  prevScores,
  favoriteTeamIds,
  onToggleFavorite,
  isAuthenticated,
  favoriteMatchIds,
  onToggleFavoriteMatch,
  hasExactScore,
}) => {
  const displayedSelection = currentSelection !== undefined ? currentSelection : savedPrediction;
  const isLocked = match.predictionLocked;

  const getMostPicked = () => {
    const v = match.votes;
    if (v.home.percentage >= v.draw.percentage && v.home.percentage >= v.away.percentage) return 'home';
    if (v.draw.percentage >= v.home.percentage && v.draw.percentage >= v.away.percentage) return 'draw';
    return 'away';
  };

  const mostPicked = getMostPicked();
  const mostPickedLabel =
    mostPicked === 'home' ? match.homeTeam.shortName || 'Home' : mostPicked === 'away' ? match.awayTeam.shortName || 'Away' : 'Draw';

  const isCurrentSaved = savedPrediction && savedPrediction === displayedSelection;
  const hasUnsavedChanges = savedPrediction && displayedSelection && savedPrediction !== displayedSelection;
  const hasSavedPrediction = !!savedPrediction;
  const hasAnyPrediction = hasSavedPrediction || hasExactScore;

  return (
    <div
      className={`match-row-card rounded-xl border overflow-hidden ${
        match.status === 'LIVE'
          ? 'live-match-card'
          : hasExactScore
            ? 'bg-amber-500/[0.06] border-amber-500/25 hover:border-amber-500/40'
            : hasSavedPrediction
              ? 'bg-emerald-500/[0.06] border-emerald-500/25 hover:border-emerald-500/40'
              : 'bg-card/50 hover:bg-card border-border/50 hover:border-border'
      }`}
      data-testid={`match-row-${match.id}`}
      data-match-id={match.id}
      style={{ contain: 'layout style', transition: 'background-color 0.2s ease, border-color 0.2s ease' }}
    >
      {/* Match Meta - shared between both views */}
      <div className="match-row-meta flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm text-muted-foreground flex-wrap">
        <StatusBadge status={match.status} statusDetail={match.statusDetail} />
        <span className="match-row-datetime whitespace-nowrap">{match.dateTime}</span>
        <span className="text-border hidden sm:inline">|</span>
        <span className="truncate">{match.competition}</span>
        <div className="ml-auto">
          <BookmarkMatch
            match={match}
            isBookmarked={favoriteMatchIds?.has(match.id)}
            onToggle={onToggleFavoriteMatch}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>

      {/* Locked Banner */}
      {isLocked && (
        <div className="mb-2">
          <div
            className={`flex items-center gap-1.5 py-1.5 rounded-lg text-xs font-medium ${
              match.status === 'LIVE'
                ? 'live-locked-banner px-3 w-fit'
                : 'bg-destructive/10 border border-destructive/20 text-destructive px-3'
            }`}
            data-testid="prediction-locked"
          >
            <Lock className="w-3 h-3" />
            <span>{match.lockReason || 'Prediction closed'}</span>
          </div>
        </div>
      )}

      {/* ======= LIST VIEW LAYOUT ======= */}
      <div className="match-row-list-layout">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Left: Team names */}
          <div className="flex flex-col gap-0 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground w-3 text-right flex-shrink-0" data-testid="team-number-home">1</span>
              <TeamCrest team={match.homeTeam} />
              <span className="text-sm md:text-base font-medium text-foreground truncate">
                {match.homeTeam.name}
              </span>
              <FavoriteHeart
                teamId={match.homeTeam.id}
                teamName={match.homeTeam.name}
                teamCrest={match.homeTeam.crest}
                isFavorite={favoriteTeamIds?.has(match.homeTeam.id)}
                onToggle={onToggleFavorite}
                isAuthenticated={isAuthenticated}
              />
            </div>
            {match.status === 'NOT_STARTED' && (
              <div className="flex items-center justify-center py-0.5">
                <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest" data-testid="vs-label">vs</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground w-3 text-right flex-shrink-0" data-testid="team-number-away">2</span>
              <TeamCrest team={match.awayTeam} />
              <span className="text-sm md:text-base font-medium text-foreground truncate">
                {match.awayTeam.name}
              </span>
              <FavoriteHeart
                teamId={match.awayTeam.id}
                teamName={match.awayTeam.name}
                teamCrest={match.awayTeam.crest}
                isFavorite={favoriteTeamIds?.has(match.awayTeam.id)}
                onToggle={onToggleFavorite}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </div>
          {/* Center: Score (only when match has started) */}
          {match.status !== 'NOT_STARTED' && (
            <ScoreDisplay score={match.score} status={match.status} prevScore={prevScores?.[match.id]} matchMinute={match.matchMinute} />
          )}
          {/* Right: Vote buttons + Action buttons */}
          <div className="flex items-center gap-1 md:gap-2">
            <VoteButton type="home" votes={match.votes.home.count} percentage={match.votes.home.percentage} isSelected={displayedSelection === 'home'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading || hasExactScore} locked={isLocked} />
            <VoteButton type="draw" votes={match.votes.draw.count} percentage={match.votes.draw.percentage} isSelected={displayedSelection === 'draw'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading || hasExactScore} locked={isLocked} />
            <VoteButton type="away" votes={match.votes.away.count} percentage={match.votes.away.percentage} isSelected={displayedSelection === 'away'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading || hasExactScore} locked={isLocked} />
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <GuessItButton currentSelection={displayedSelection} savedPrediction={savedPrediction} isLoading={isLoading} onClick={() => onGuessIt(match.id)} locked={isLocked} hasExactScore={hasExactScore} />
            <AdvanceButton onClick={() => onAdvance(match.id)} disabled={isLoading || isLocked || hasSavedPrediction} />
            <RemoveButton onClick={() => onRefresh(match.id)} disabled={isLoading || isLocked} hasSelection={!!displayedSelection || hasSavedPrediction} hasExactScore={hasExactScore} />
          </div>
        </div>
      </div>

      {/* ======= GRID VIEW LAYOUT ======= */}
      <div className="match-row-grid-layout">
        <div className="space-y-2.5">
          {/* Teams + Score row */}
          <div className="flex items-center">
            <div className="flex flex-col gap-0 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground w-2.5 text-right flex-shrink-0" data-testid="team-number-home">1</span>
                <TeamCrest team={match.homeTeam} />
                <span className="text-xs font-medium text-foreground truncate">{match.homeTeam.name}</span>
                <FavoriteHeart
                  teamId={match.homeTeam.id}
                  teamName={match.homeTeam.name}
                  teamCrest={match.homeTeam.crest}
                  isFavorite={favoriteTeamIds?.has(match.homeTeam.id)}
                  onToggle={onToggleFavorite}
                  isAuthenticated={isAuthenticated}
                />
              </div>
              {match.status === 'NOT_STARTED' && (
                <div className="flex items-center justify-center py-0.5">
                  <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest" data-testid="vs-label">vs</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground w-2.5 text-right flex-shrink-0" data-testid="team-number-away">2</span>
                <TeamCrest team={match.awayTeam} />
                <span className="text-xs font-medium text-foreground truncate">{match.awayTeam.name}</span>
                <FavoriteHeart
                  teamId={match.awayTeam.id}
                  teamName={match.awayTeam.name}
                  teamCrest={match.awayTeam.crest}
                  isFavorite={favoriteTeamIds?.has(match.awayTeam.id)}
                  onToggle={onToggleFavorite}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </div>
            {match.status !== 'NOT_STARTED' && (
              <ScoreDisplay score={match.score} status={match.status} prevScore={prevScores?.[match.id]} matchMinute={match.matchMinute} />
            )}
          </div>
          {/* Vote + Action buttons — stacked on mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
            <div className="flex items-center gap-1 flex-1">
              <VoteButton type="home" votes={match.votes.home.count} percentage={match.votes.home.percentage} isSelected={displayedSelection === 'home'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading || hasExactScore} locked={isLocked} />
              <VoteButton type="draw" votes={match.votes.draw.count} percentage={match.votes.draw.percentage} isSelected={displayedSelection === 'draw'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading || hasExactScore} locked={isLocked} />
              <VoteButton type="away" votes={match.votes.away.count} percentage={match.votes.away.percentage} isSelected={displayedSelection === 'away'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading || hasExactScore} locked={isLocked} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <GuessItButton currentSelection={displayedSelection} savedPrediction={savedPrediction} isLoading={isLoading} onClick={() => onGuessIt(match.id)} locked={isLocked} hasExactScore={hasExactScore} />
              <AdvanceButton onClick={() => onAdvance(match.id)} disabled={isLoading || isLocked || hasSavedPrediction} />
              <RemoveButton onClick={() => onRefresh(match.id)} disabled={isLoading || isLocked} hasSelection={!!displayedSelection || hasSavedPrediction} hasExactScore={hasExactScore} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Stats - shared */}
      <div className="match-row-footer flex items-center gap-2 sm:gap-3 pt-2 sm:pt-2.5 border-t border-border/30 flex-wrap text-[10px] sm:text-xs">
        <span className="text-muted-foreground">
          Total votes: <span className="text-foreground font-medium">{match.totalVotes.toLocaleString()}</span>
        </span>
        <span className="text-muted-foreground">
          Most picked: <span className="text-primary font-medium">{mostPickedLabel}</span>
        </span>
        {isCurrentSaved && (
          <span className="text-primary font-medium flex items-center gap-1">
            <Check className="w-3 h-3" />
            Pick: {displayedSelection === 'home' ? '1' : displayedSelection === 'draw' ? 'X' : '2'}
          </span>
        )}
        {hasExactScore && (
          <span className="text-amber-500 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" />
            Exact Score
          </span>
        )}
        {hasUnsavedChanges && (
          <span className="text-yellow-500 font-medium flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Unsaved
          </span>
        )}
      </div>
    </div>
  );
});
MatchRow.displayName = 'MatchRow';

// ============ Main MatchList ============
export const MatchList = ({ matches, savedPredictions = {}, onPredictionSaved, activeLeague, viewMode = 'grid', favoriteTeamIds, onToggleFavorite, favoriteMatchIds, onToggleFavoriteMatch }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [currentSelections, setCurrentSelections] = useState({});
  const [loadingMatches, setLoadingMatches] = useState({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPrediction, setPendingPrediction] = useState(null);
  const [prevScores, setPrevScores] = useState({});
  const [advancedModalMatch, setAdvancedModalMatch] = useState(null);
  const [exactScoreMatchIds, setExactScoreMatchIds] = useState(new Set());
  const containerRef1 = useRef(null);
  const containerRef2 = useRef(null);

  // Fetch exact score predictions on mount
  useEffect(() => {
    if (isAuthenticated) {
      getMyExactScorePredictions()
        .then(data => {
          const ids = new Set((data.exact_score_predictions || []).map(p => p.match_id));
          setExactScoreMatchIds(ids);
        })
        .catch(() => {});
    } else {
      setExactScoreMatchIds(new Set());
    }
  }, [isAuthenticated]);

  // Track score changes for animation
  const prevMatchesRef = useRef(matches);
  useEffect(() => {
    const oldMap = {};
    prevMatchesRef.current.forEach((m) => {
      if (m.score) oldMap[m.id] = m.score;
    });
    setPrevScores(oldMap);
    prevMatchesRef.current = matches;
  }, [matches]);

  const handleSelectPrediction = useCallback((matchId, prediction) => {
    setCurrentSelections((prev) => {
      if (prev[matchId] === prediction) return { ...prev, [matchId]: null };
      return { ...prev, [matchId]: prediction };
    });
  }, []);

  const handleRefresh = useCallback(async (matchId) => {
    setCurrentSelections((prev) => ({ ...prev, [matchId]: null }));
    setLoadingMatches((prev) => ({ ...prev, [matchId]: true }));
    
    const hadSavedPrediction = !!savedPredictions[matchId];
    const hadExactScore = exactScoreMatchIds.has(matchId);
    
    try {
      const promises = [];
      
      // Delete normal prediction if exists
      if (hadSavedPrediction) {
        promises.push(deletePrediction(matchId));
      }
      
      // Delete exact score prediction if exists
      if (hadExactScore) {
        promises.push(
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/predictions/exact-score/match/${matchId}`, {
            method: 'DELETE',
            credentials: 'include'
          })
        );
      }
      
      if (promises.length > 0) {
        await Promise.all(promises);
        
        // Clear normal prediction state
        if (hadSavedPrediction && onPredictionSaved) {
          onPredictionSaved(matchId, null);
        }
        
        // Clear exact score state
        if (hadExactScore) {
          setExactScoreMatchIds(prev => {
            const next = new Set(prev);
            next.delete(matchId);
            return next;
          });
        }
        
        toast.success('Prediction removed', { description: 'All predictions for this match have been cleared.', duration: 2000 });
      } else {
        toast.info('Selection cleared', { duration: 2000 });
      }
    } catch (error) {
      toast.error('Failed to remove prediction', { description: error.message, duration: 3000 });
    } finally {
      setLoadingMatches((prev) => ({ ...prev, [matchId]: false }));
    }
  }, [savedPredictions, onPredictionSaved, exactScoreMatchIds]);

  const handleAdvance = useCallback((matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (match) {
      setAdvancedModalMatch(match);
    }
  }, [matches]);

  const handleCloseAdvancedModal = useCallback(() => {
    setAdvancedModalMatch(null);
  }, []);

  const handleExactScoreSaved = useCallback((matchId) => {
    setExactScoreMatchIds(prev => new Set([...prev, matchId]));
  }, []);

  const handleNavigateLoginFromAdvanced = useCallback(() => {
    handleCloseAdvancedModal();
    navigate('/login');
  }, [navigate, handleCloseAdvancedModal]);

  const getEffectiveSelection = useCallback(
    (matchId) => {
      if (matchId in currentSelections) return currentSelections[matchId];
      return savedPredictions[matchId] || null;
    },
    [currentSelections, savedPredictions]
  );

  const handleGuessIt = useCallback(
    async (matchId) => {
      const selection = getEffectiveSelection(matchId);
      if (!selection) {
        toast.error('Please select an option first', {
          description: 'Choose 1, X, or 2 before making your prediction.',
          duration: 3000,
        });
        return;
      }
      if (savedPredictions[matchId] === selection) {
        toast.info('Prediction already saved', { duration: 2000 });
        return;
      }
      if (!isAuthenticated) {
        setPendingPrediction({ matchId, prediction: selection });
        setShowAuthModal(true);
        return;
      }

      // Optimistic update: immediately show as saved
      const previousPrediction = savedPredictions[matchId];
      if (onPredictionSaved) onPredictionSaved(matchId, selection);
      setCurrentSelections((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });

      setLoadingMatches((prev) => ({ ...prev, [matchId]: true }));
      try {
        const result = await savePrediction(matchId, selection);
        toast.success(result.is_new ? 'Prediction saved!' : 'Prediction updated!', {
          description: `You predicted: ${selection === 'home' ? 'Home Win (1)' : selection === 'draw' ? 'Draw (X)' : 'Away Win (2)'}`,
          duration: 2000,
        });
      } catch (error) {
        // Revert optimistic update on failure
        if (onPredictionSaved) onPredictionSaved(matchId, previousPrediction || null);
        setCurrentSelections((prev) => ({ ...prev, [matchId]: selection }));
        toast.error('Failed to save prediction', { description: error.message, duration: 3000 });
      } finally {
        setLoadingMatches((prev) => ({ ...prev, [matchId]: false }));
      }
    },
    [getEffectiveSelection, savedPredictions, isAuthenticated, onPredictionSaved]
  );

  const handleAuthModalLogin = useCallback(() => {
    if (pendingPrediction) sessionStorage.setItem('pendingPrediction', JSON.stringify(pendingPrediction));
    setShowAuthModal(false);
    navigate('/login');
  }, [pendingPrediction, navigate]);

  const handleAuthModalRegister = useCallback(() => {
    if (pendingPrediction) sessionStorage.setItem('pendingPrediction', JSON.stringify(pendingPrediction));
    setShowAuthModal(false);
    navigate('/register');
  }, [pendingPrediction, navigate]);

  const handleCloseAuthModal = useCallback(() => {
    setShowAuthModal(false);
    setPendingPrediction(null);
  }, []);

  // Filter only for live filter - memoized for performance
  const displayMatches = useMemo(
    () => activeLeague === 'live' ? matches.filter((m) => m.status === 'LIVE') : matches,
    [matches, activeLeague]
  );

  // Separate live matches for the dedicated section (only when showing "all" or specific league, not "live" filter) - memoized
  const liveMatches = useMemo(
    () => activeLeague !== 'live' ? displayMatches.filter((m) => m.status === 'LIVE') : [],
    [displayMatches, activeLeague]
  );
  const nonLiveMatches = useMemo(
    () => activeLeague !== 'live' ? displayMatches.filter((m) => m.status !== 'LIVE') : displayMatches,
    [displayMatches, activeLeague]
  );

  return (
    <>
      <div className="mt-4 sm:mt-6">
        {/* Live Matches Section */}
        {liveMatches.length > 0 && (
          <div className="mb-6 sm:mb-8" data-testid="live-matches-section">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <h3 className="text-base sm:text-lg font-semibold text-foreground" data-testid="live-section-title">Live Matches</h3>
              </div>
              <span className="text-xs text-muted-foreground">({liveMatches.length})</span>
            </div>
            <div
              ref={containerRef1}
              className={`match-list-container ${viewMode === 'grid' ? 'match-view-grid' : 'match-view-list'}`}
              data-testid="live-match-list-container"
              data-view-mode={viewMode}
            >
              {liveMatches.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  currentSelection={currentSelections[match.id]}
                  savedPrediction={savedPredictions[match.id]}
                  onSelectPrediction={handleSelectPrediction}
                  onGuessIt={handleGuessIt}
                  onRefresh={handleRefresh}
                  onAdvance={handleAdvance}
                  isLoading={loadingMatches[match.id]}
                  prevScores={prevScores}
                  favoriteTeamIds={favoriteTeamIds}
                  onToggleFavorite={onToggleFavorite}
                  isAuthenticated={isAuthenticated}
                  favoriteMatchIds={favoriteMatchIds}
                  onToggleFavoriteMatch={onToggleFavoriteMatch}
                  hasExactScore={exactScoreMatchIds.has(match.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Matches Section */}
        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
          {activeLeague === 'live' ? 'Live Matches' : 'All Matches'}
        </h3>
        <div
          ref={containerRef2}
          className={`match-list-container ${viewMode === 'grid' ? 'match-view-grid' : 'match-view-list'}`}
          data-testid="match-list-container"
          data-view-mode={viewMode}
        >
          {nonLiveMatches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              currentSelection={currentSelections[match.id]}
              savedPrediction={savedPredictions[match.id]}
              onSelectPrediction={handleSelectPrediction}
              onGuessIt={handleGuessIt}
              onRefresh={handleRefresh}
              onAdvance={handleAdvance}
              isLoading={loadingMatches[match.id]}
              prevScores={prevScores}
              favoriteTeamIds={favoriteTeamIds}
              onToggleFavorite={onToggleFavorite}
              isAuthenticated={isAuthenticated}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={onToggleFavoriteMatch}
              hasExactScore={exactScoreMatchIds.has(match.id)}
            />
          ))}
        </div>
        {nonLiveMatches.length === 0 && liveMatches.length === 0 && (
          <div className="text-center py-8 text-muted-foreground" data-testid="no-matches-in-list">
            No matches to display for this filter.
          </div>
        )}
      </div>

      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={handleCloseAuthModal}
        onLogin={handleAuthModalLogin}
        onRegister={handleAuthModalRegister}
      />

      <AdvancedOptionsModal
        isOpen={!!advancedModalMatch}
        onClose={handleCloseAdvancedModal}
        match={advancedModalMatch}
        isAuthenticated={isAuthenticated}
        onNavigateLogin={handleNavigateLoginFromAdvanced}
        onExactScoreSaved={handleExactScoreSaved}
        savedPrediction={advancedModalMatch ? savedPredictions[advancedModalMatch.id] : null}
      />
    </>
  );
};

export default MatchList;
