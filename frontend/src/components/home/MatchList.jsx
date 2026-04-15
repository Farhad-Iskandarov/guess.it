import { useState, useCallback, memo, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, Loader2, Check, AlertCircle, RefreshCw, Trash2, Sparkles, Lock, Radio, Heart, Bell, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { savePrediction, deletePrediction } from '@/services/predictions';
import { addFavoriteClub, removeFavoriteClub } from '@/services/favorites';
import { addFavoriteMatch, removeFavoriteMatch } from '@/services/messages';
import { formatLocalDateTime } from '@/utils/formatTime';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

// Static competition → country mapping
const COMPETITION_COUNTRIES = {
  'Premier League': 'England',
  'Bundesliga': 'Germany',
  'Serie A': 'Italy',
  'Primera Division': 'Spain',
  'La Liga': 'Spain',
  'Ligue 1': 'France',
  'UEFA Champions League': 'Europe',
  'UEFA Europa League': 'Europe',
  'UEFA Conference League': 'Europe',
  'Eredivisie': 'Netherlands',
  'Primeira Liga': 'Portugal',
  'Liga Portugal': 'Portugal',
  'Saudi Pro League': 'Saudi Arabia',
  'Jupiler Pro League': 'Belgium',
  'Super Lig': 'Turkey',
};

// ============ Status Badge ============
const StatusBadge = memo(({ status, statusDetail, matchMinute }) => {
  if (status === 'LIVE') {
    const displayText = statusDetail === 'HT' ? 'HT'
      : statusDetail === 'PEN' ? 'PEN'
      : matchMinute ? matchMinute
      : 'LIVE';
    return (
      <div className="inline-flex items-center gap-1.5" data-testid="live-badge">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30"
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          {displayText}
        </span>
      </div>
    );
  }
  if (status === 'FINISHED') {
    const label = statusDetail === 'AET' ? 'AET' : statusDetail === 'PEN' ? 'PEN' : 'FT';
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-muted text-muted-foreground border border-border"
        data-testid="ft-badge"
      >
        {label}
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

// ============ Team Crest Image (larger for new design) ============
const TeamCrest = memo(({ team, large }) => {
  const size = large ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-6 h-6 md:w-7 md:h-7';
  if (team.crest) {
    return (
      <img
        src={team.crest}
        alt={team.name}
        className={`${size} rounded-full object-contain bg-secondary flex-shrink-0`}
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

// ============ Bell Notification Button (replaces Bookmark) ============
const BellNotification = memo(({ match, isBookmarked, onToggle, isAuthenticated }) => {
  const [animating, setAnimating] = useState(false);
  const [optimistic, setOptimistic] = useState(null);

  useEffect(() => { setOptimistic(null); }, [isBookmarked]);

  const display = optimistic !== null ? optimistic : isBookmarked;

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) return;
    const newState = !display;
    setOptimistic(newState);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 200);
    onToggle(match, newState).catch(() => setOptimistic(!newState));
  };

  return (
    <button
      onClick={handleClick}
      className="flex-shrink-0 p-1 rounded-md hover:bg-muted/50 active:scale-90 transition-all duration-100"
      data-testid={`bell-match-${match.id}`}
      aria-label={display ? 'Remove notification' : 'Set notification'}
    >
      <Bell
        className={`w-4 h-4 transition-all duration-100 ${
          display
            ? 'text-amber-400 fill-amber-400'
            : 'text-muted-foreground/50 hover:text-amber-400'
        } ${animating ? 'scale-125' : 'scale-100'}`}
      />
    </button>
  );
});
BellNotification.displayName = 'BellNotification';

// ============ League Header ============
const LeagueHeader = memo(({ competition, competitionEmblem, competitionCountry }) => {
  const country = competitionCountry || COMPETITION_COUNTRIES[competition] || '';

  return (
    <div className="flex items-center gap-3 py-2 px-1" data-testid={`league-header-${competition}`}>
      {/* League Logo */}
      <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary/80 flex items-center justify-center overflow-hidden">
        {competitionEmblem ? (
          <img
            src={competitionEmblem}
            alt={competition}
            className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <span className="text-base font-bold text-muted-foreground">{competition.charAt(0)}</span>
        )}
      </div>
      {/* League name + country */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm sm:text-base font-bold text-foreground truncate">{competition}</h3>
        {country && <p className="text-[11px] sm:text-xs text-muted-foreground">{country}</p>}
      </div>
      {/* Arrow */}
      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
    </div>
  );
});
LeagueHeader.displayName = 'LeagueHeader';

// ============ Prediction Bars (3 columns side-by-side, bar on top, label below — DISPLAY ONLY) ============
const PredictionBars = memo(({ votes, selectedType, locked, dynamicPoints }) => {
  const items = [
    { type: 'home', label: '1', pct: votes.home.percentage },
    { type: 'draw', label: 'X', pct: votes.draw.percentage },
    { type: 'away', label: '2', pct: votes.away.percentage },
  ];

  return (
    <div className="flex items-end gap-2 sm:gap-3">
      {items.map(({ type, label, pct }) => {
        const isSelected = selectedType === type;
        return (
          <div
            key={type}
            data-testid={`vote-btn-${type}`}
            className="flex-1 flex flex-col items-center gap-1 cursor-default select-none"
          >
            {/* Bar */}
            <div className={`w-full h-1 rounded-full overflow-hidden ${
              isSelected ? 'bg-primary/30' : 'bg-muted/80'
            }`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isSelected ? 'bg-primary' : 'bg-muted-foreground/50'
                }`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
            {/* Percentage */}
            <span className={`text-[11px] sm:text-xs font-semibold tabular-nums ${
              isSelected ? 'text-primary' : 'text-emerald-500/80'
            }`}>
              {label}: {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
});
PredictionBars.displayName = 'PredictionBars';

// ============ Predict Match Button (opens Advanced modal — same as old Advance button) ============
const PredictMatchButton = memo(({ onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    data-testid="guess-it-btn"
    className={`w-full mt-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-widest transition-all duration-200 ${
      disabled
        ? 'bg-muted/20 border-2 border-border/30 text-muted-foreground/40 cursor-not-allowed'
        : 'bg-[#1a3a2a] border-2 border-emerald-600/50 text-white hover:bg-[#1f4533] hover:border-emerald-500/70 active:scale-[0.98]'
    }`}
  >
    PREDICT MATCH
  </button>
));
PredictMatchButton.displayName = 'PredictMatchButton';

// ============ Countdown Timer (for meta bar) ============
const MetaCountdown = memo(({ utcDate, matchStatus, hasPrediction }) => {
  const [now, setNow] = useState(Date.now());
  const kickoff = utcDate ? new Date(utcDate).getTime() : 0;
  const remaining = kickoff ? Math.max(0, kickoff - now) : 0;
  const remainingS = Math.floor(remaining / 1000);
  const remainingH = remaining / 3600000;

  const phase = !utcDate || matchStatus === 'LIVE' || matchStatus === 'FINISHED' ? 'none'
    : remaining <= 0 ? 'none'
    : remainingH > 24 ? 'none'
    : remainingH > 6 ? 'label'
    : remainingH > 1 ? 'countdown'
    : 'urgency';

  useEffect(() => {
    if (phase === 'none') return;
    const interval = phase === 'label' ? 60000 : 1000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [phase]);

  if (phase === 'none') return null;

  const urgencyIntensity = phase === 'urgency' ? Math.min(1, (3600 - remainingS) / 3600) : 0;
  const isUrgentUnpredicted = phase === 'urgency' && !hasPrediction;

  const formatTime = () => {
    if (phase === 'label') return `Starts in ${Math.ceil(remainingH)}h`;
    const h = Math.floor(remainingS / 3600);
    const m = Math.floor((remainingS % 3600) / 60);
    const s = remainingS % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <span
      data-testid="meta-countdown"
      className={`ml-auto whitespace-nowrap tabular-nums font-semibold text-[10px] sm:text-xs ${
        isUrgentUnpredicted
          ? 'meta-countdown-urgency'
          : phase === 'urgency'
            ? 'text-amber-400'
            : 'text-muted-foreground/70'
      }`}
      style={isUrgentUnpredicted ? {
        color: `hsl(${Math.round(30 - urgencyIntensity * 30)}, ${Math.round(80 + urgencyIntensity * 20)}%, ${Math.round(55 - urgencyIntensity * 10)}%)`,
      } : {}}
    >
      {formatTime()}
    </span>
  );
});
MetaCountdown.displayName = 'MetaCountdown';

// ============ GUESS IT Button ============
const GuessItButton = memo(({ currentSelection, savedPrediction, isLoading, onClick, locked, hasExactScore, utcDate, matchStatus }) => {
  const hasSelection = !!currentSelection;
  const hasSaved = !!savedPrediction;
  const isCurrentSaved = hasSaved && savedPrediction === currentSelection;
  const hasUnsavedChanges = hasSaved && currentSelection && savedPrediction !== currentSelection;
  const blockedByExactScore = hasExactScore && !hasSaved;

  // Timer state
  const [now, setNow] = useState(Date.now());
  const kickoff = utcDate ? new Date(utcDate).getTime() : 0;
  const remaining = kickoff ? Math.max(0, kickoff - now) : 0;
  const remainingS = Math.floor(remaining / 1000);
  const remainingH = remaining / 3600000;

  // Timer phase: 'label' (>6h), 'countdown' (6h-1h), 'urgency' (<1h), 'locked' (0), 'none' (>24h or no date)
  const timerPhase = !utcDate || matchStatus === 'LIVE' || matchStatus === 'FINISHED' || locked ? 'none'
    : remaining <= 0 ? 'locked'
    : remainingH > 24 ? 'none'
    : remainingH > 6 ? 'label'
    : remainingH > 1 ? 'countdown'
    : 'urgency';

  // Tick every second only when countdown/urgency active
  useEffect(() => {
    if (timerPhase !== 'countdown' && timerPhase !== 'urgency' && timerPhase !== 'label') return;
    const interval = timerPhase === 'label' ? 60000 : 1000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [timerPhase]);

  // Format countdown
  const formatCountdown = () => {
    const h = Math.floor(remainingS / 3600);
    const m = Math.floor((remainingS % 3600) / 60);
    const s = remainingS % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatLabel = () => {
    const h = Math.ceil(remainingH);
    return `Starts in ${h}h`;
  };

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
  const isDisabled = locked || isLoading || blockedByExactScore || (!hasSelection && !hasSaved);
  const showTimer = (timerPhase === 'label' || timerPhase === 'countdown' || timerPhase === 'urgency') && !state.isSaved && !state.isLocked && !isLoading;

  // Urgency intensity: 0-1, increases as time approaches 0
  const urgencyIntensity = timerPhase === 'urgency' ? Math.min(1, (3600 - remainingS) / 3600) : 0;
  const isLastTenMin = timerPhase === 'urgency' && remainingS <= 600;
  const isLastTwoMin = timerPhase === 'urgency' && remainingS <= 120;

  // Dynamic urgency class selection
  const urgencyClass = timerPhase === 'urgency'
    ? isLastTwoMin
      ? 'guess-btn-urgency guess-btn-critical guess-glow-active'
      : isLastTenMin
        ? 'guess-btn-urgency guess-btn-shake guess-glow-active'
        : 'guess-btn-urgency'
    : '';

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      data-testid="guess-it-btn"
      className={`
        group/guess relative match-action-btn h-[56px] sm:h-[72px] md:h-[84px] rounded-xl font-bold text-xs sm:text-sm md:text-base overflow-hidden
        ${state.isLocked
          ? 'bg-muted border-2 border-border text-muted-foreground cursor-not-allowed'
          : state.isSaved
            ? state.isExactScore
              ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-500'
              : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary/30'
            : timerPhase === 'urgency'
              ? 'border-2 border-red-500/50 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
        }
        ${isDisabled && !state.isSaved && !state.isLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
        ${urgencyClass}
      `}
      style={{
        transition: 'background-color 0.3s ease, transform 0.1s ease, box-shadow 0.1s ease, border-color 0.3s ease',
        ...(timerPhase === 'urgency' && !state.isSaved ? {
          backgroundColor: `hsl(${Math.round(142 - urgencyIntensity * 142)}, ${Math.round(50 + urgencyIntensity * 20)}%, ${Math.round(35 - urgencyIntensity * 10)}%)`,
          borderColor: `hsl(${Math.round(142 - urgencyIntensity * 142)}, ${Math.round(50 + urgencyIntensity * 30)}%, ${Math.round(45 - urgencyIntensity * 10)}%)`,
        } : {}),
      }}
    >
      {showTimer ? (
        /* Timer + GuessIt slide container */
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Timer layer — visible by default, slides up on hover */}
          <div className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover/guess:-translate-y-full group-hover/guess:opacity-0">
            {timerPhase === 'label' && (
              <span className="text-[10px] sm:text-xs font-semibold opacity-90">{formatLabel()}</span>
            )}
            {(timerPhase === 'countdown' || timerPhase === 'urgency') && (
              <span className="text-xs sm:text-sm md:text-base font-bold tabular-nums tracking-wider">{formatCountdown()}</span>
            )}
          </div>
          {/* GuessIt layer — hidden below, slides up on hover */}
          <div className="absolute inset-0 flex flex-col items-center justify-center translate-y-full opacity-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover/guess:translate-y-0 group-hover/guess:opacity-100">
            <span className="text-base sm:text-lg font-bold">G</span>
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold">GUESS IT</span>
          </div>
        </div>
      ) : (
        /* Standard button content (saved/locked/loading/GUESS IT) */
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
      )}
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
      relative match-action-btn-sm h-[56px] sm:h-[72px] md:h-[84px] rounded-xl font-extrabold text-xs sm:text-sm md:text-base
      border-2 border-amber-500/40 hover:border-amber-500
      bg-gradient-to-br from-amber-500/10 to-orange-500/15
      hover:from-amber-500/25 hover:to-orange-500/25
      text-amber-500 dark:text-amber-400
      hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25
      ${disabled ? 'opacity-40 cursor-not-allowed hover:scale-100' : ''}
    `}
    style={{ transition: 'background-color 0.15s ease, transform 0.15s ease, border-color 0.15s ease' }}
  >
    <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1">
      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wide">Advance</span>
    </div>
  </Button>
));
AdvanceButton.displayName = 'AdvanceButton';

// ============ Advanced Options Modal ============
import { Target, Lightbulb, UserPlus, Users, X as XIcon, Search, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { saveExactScorePrediction, getExactScorePrediction, getMyExactScorePredictions, deleteExactScorePrediction } from '@/services/predictions';
import { useFriends } from '@/lib/FriendsContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdvancedOptionsModal = memo(({ isOpen, onClose, match, isAuthenticated, onNavigateLogin, onExactScoreSaved, savedPrediction, onQuickPredict }) => {
  const [activeSection, setActiveSection] = useState('quick-predict');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
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
            setHomeScore(String(pred.home_score));
            setAwayScore(String(pred.away_score));
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
    const h = homeScore === '' ? 0 : parseInt(homeScore, 10);
    const a = awayScore === '' ? 0 : parseInt(awayScore, 10);
    setIsSubmitting(true);
    try {
      await saveExactScorePrediction(match.id, h, a);
      setExistingPrediction({ home_score: h, away_score: a });
      if (onExactScoreSaved) onExactScoreSaved(match.id);
      toast.success('Exact score prediction saved!', {
        description: `${match.homeTeam.name} ${h} - ${a} ${match.awayTeam.name}`,
        duration: 3000
      });
    } catch (error) {
      toast.error('Could not save prediction', { description: 'Please try again.', duration: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExactScoreRemove = async () => {
    setIsSubmitting(true);
    try {
      await deleteExactScorePrediction(match.id);
      setExistingPrediction(null);
      setHomeScore('');
      setAwayScore('');
      if (onExactScoreSaved) onExactScoreSaved(match.id);
      toast.success('Exact score prediction removed', { duration: 2000 });
    } catch (error) {
      toast.error('Could not remove prediction', { description: 'Please try again.', duration: 3000 });
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
          match_date: match.utcDate || match.dateTime,
          match_card: {
            match_id: match.id,
            homeTeam: { name: match.homeTeam?.name, crest: match.homeTeam?.crest || match.homeTeam?.logo },
            awayTeam: { name: match.awayTeam?.name, crest: match.awayTeam?.crest || match.awayTeam?.logo },
            competition: match.competition || '',
            dateTime: match.dateTime || '',
            utcDate: match.utcDate || '',
            status: match.status || 'NOT_STARTED',
            score: match.score || {}
          }
        })
      });
      
      if (response.ok) {
        // Briefly show "Sent!" then reset so user can send again
        setInvitedFriends(prev => new Set([...prev, friend.user_id]));
        toast.success('Invitation sent!', {
          description: `${friend.nickname} will receive a notification`,
          duration: 3000
        });
        // Reset after brief delay so button becomes clickable again
        setTimeout(() => {
          setInvitedFriends(prev => {
            const next = new Set(prev);
            next.delete(friend.user_id);
            return next;
          });
        }, 1500);
      } else {
        toast.error('Could not send invitation', { description: 'Please try again.' });
      }
    } catch {
      toast.error('Could not send invitation', { description: 'Please try again.' });
    } finally {
      setInvitingFriend(null);
    }
  };

  if (!match) return null;

  const sections = [
    { id: 'quick-predict', label: 'Quick Predict', icon: Trophy, color: 'emerald' },
    { id: 'exact-score', label: 'Exact Score', icon: Target, color: 'amber' },
    { id: 'smart-advice', label: 'Smart Advice', icon: Lightbulb, color: 'sky' },
    { id: 'invite', label: 'Invite Friend', icon: UserPlus, color: 'emerald' },
    { id: 'friends', label: 'Friends Activity', icon: Users, color: 'purple' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 max-h-[85vh] w-[92vw] sm:w-full rounded-xl sm:rounded-lg gap-0">
        <div className="bg-card overflow-hidden rounded-xl sm:rounded-lg">
          {/* Header */}
          <div className="px-3 py-3 sm:px-4 sm:py-4 border-b border-border/50">
            <DialogTitle className="text-base sm:text-lg font-bold">Advanced Options</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground line-clamp-2 break-words leading-tight">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </DialogDescription>
          </div>

          {/* Section Tabs */}
          <div className="flex border-b border-border/30 overflow-x-auto scrollbar-hide -mx-px">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => !section.disabled && setActiveSection(section.id)}
                disabled={section.disabled}
                className={`flex-shrink-0 min-w-0 px-3 sm:px-4 py-2.5 text-[10px] sm:text-xs font-medium transition-all border-b-2 whitespace-nowrap ${
                  activeSection === section.id
                    ? `border-${section.color}-500 text-${section.color}-500 bg-${section.color}-500/5`
                    : section.disabled
                      ? 'border-transparent text-muted-foreground/50 cursor-not-allowed'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <section.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-auto mb-0.5 sm:mb-1" />
                {section.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="px-3 py-4 sm:p-4 min-h-[200px] overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
            {!isAuthenticated ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">Please sign in to access advanced features</p>
                <Button onClick={onNavigateLogin}>Sign In</Button>
              </div>
            ) : activeSection === 'quick-predict' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Quick Prediction</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tap to predict the match winner — points are dynamic based on popularity
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                  {[
                    { type: 'home', label: match.homeTeam?.name || 'Home', shortLabel: '1' },
                    { type: 'draw', label: 'Draw', shortLabel: 'X' },
                    { type: 'away', label: match.awayTeam?.name || 'Away', shortLabel: '2' },
                  ].map(opt => {
                    const isSelected = savedPrediction === opt.type;
                    const dynPts = match.dynamicPoints?.[opt.type];
                    const dynLabel = match.dynamicPoints?.[`${opt.type}_label`];
                    return (
                      <button
                        key={opt.type}
                        onClick={() => {
                          if (onQuickPredict) onQuickPredict(match.id, opt.type);
                        }}
                        data-testid={`quick-predict-${opt.type}`}
                        className={`flex flex-col items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-3 sm:py-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200 ${
                          isSelected
                            ? 'bg-primary/20 border-primary text-primary shadow-glow ring-1 ring-primary/30 scale-[1.03]'
                            : 'bg-card border-border/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        <span className={`text-xl sm:text-2xl font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {opt.shortLabel}
                        </span>
                        <span className="text-[9px] sm:text-xs line-clamp-2 break-words max-w-full leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                {savedPrediction && (
                  <p className="text-xs text-emerald-500 font-medium text-center">
                    Your current pick: {savedPrediction === 'home' ? match.homeTeam?.name : savedPrediction === 'away' ? match.awayTeam?.name : 'Draw'}
                  </p>
                )}
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
                    <Button
                      variant="ghost"
                      onClick={handleExactScoreRemove}
                      disabled={isSubmitting}
                      className="mt-3 w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 gap-2"
                      data-testid="remove-exact-score-btn"
                    >
                      <XIcon className="w-4 h-4" />
                      {isSubmitting ? 'Removing...' : 'Remove Exact Score'}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 text-center">
                        <label className="text-xs text-muted-foreground block mb-1 line-clamp-2 break-words leading-tight">{match.homeTeam.name}</label>
                        <input
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          value={homeScore}
                          onChange={e => { const v = e.target.value; if (v === '') { setHomeScore(''); return; } const n = parseInt(v, 10); if (!isNaN(n)) setHomeScore(String(Math.min(Math.max(n, 0), 99))); }}
                          placeholder="0"
                          className="flex h-12 w-full rounded-md border border-border/30 bg-background px-3 py-2 text-xl font-bold text-center text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          data-testid="modal-exact-home"
                        />
                      </div>
                      <span className="text-2xl font-bold text-muted-foreground pt-5">-</span>
                      <div className="flex-1 text-center">
                        <label className="text-xs text-muted-foreground block mb-1 line-clamp-2 break-words leading-tight">{match.awayTeam.name}</label>
                        <input
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          value={awayScore}
                          onChange={e => { const v = e.target.value; if (v === '') { setAwayScore(''); return; } const n = parseInt(v, 10); if (!isNaN(n)) setAwayScore(String(Math.min(Math.max(n, 0), 99))); }}
                          placeholder="0"
                          className="flex h-12 w-full rounded-md border border-border/30 bg-background px-3 py-2 text-xl font-bold text-center text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

// ============ Match Row (Clean compact card — matches reference design exactly) ============
const MatchRow = memo(({
  match,
  currentSelection,
  savedPrediction,
  onGuessIt,
  onAdvance,
  isLoading,
  prevScores,
  favoriteTeamIds,
  onToggleFavorite,
  isAuthenticated,
  favoriteMatchIds,
  onToggleFavoriteMatch,
  hasExactScore,
  onNavigateMatch,
}) => {
  const displayedSelection = savedPrediction || currentSelection || null;
  const isLocked = match.predictionLocked;
  const isLive = match.status === 'LIVE' || match.status === 'IN_PLAY';
  const isFinished = match.status === 'FINISHED';

  // Format date for top row: "Fri,10Apr"
  const getDateStr = () => {
    if (!match.utcDate) return '';
    try {
      const dt = new Date(match.utcDate);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${days[dt.getDay()]},${String(dt.getDate()).padStart(2, '0')}${months[dt.getMonth()]}`;
    } catch { return ''; }
  };

  // Format time: "20:45"
  const getTimeStr = () => {
    if (!match.utcDate) return '';
    try {
      return new Date(match.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors duration-200 cursor-pointer ${
        isLive ? 'bg-card border-red-500/30' : 'bg-card border-border/70 hover:border-border'
      }`}
      data-testid={`match-row-${match.id}`}
      data-match-id={match.id}
      onClick={(e) => {
        // Don't navigate if clicking on interactive elements
        const target = e.target.closest('button, a, input, [data-testid="guess-it-btn"], [data-testid="advance-prediction-btn"], [data-testid="remove-prediction-btn"], [data-testid^="bell-match-"], [data-testid^="fav-heart-"]');
        if (target) return;
        onNavigateMatch(match.id);
      }}
    >
      <div className="px-4 py-4 sm:px-5 sm:py-4 space-y-3">

        {/* === TOP ROW: Date | Time | Countdown + Bell === */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/30">
          <span className="font-medium">
            {isLive ? (
              <StatusBadge status={match.status} statusDetail={match.statusDetail} matchMinute={match.matchMinute} />
            ) : isFinished ? (
              <StatusBadge status={match.status} statusDetail={match.statusDetail} />
            ) : (
              getDateStr()
            )}
          </span>
          <span className="font-semibold text-foreground text-sm">
            {isLive || isFinished ? '' : getTimeStr()}
          </span>
          <div className="flex items-center gap-1.5">
            <MetaCountdown utcDate={match.utcDate} matchStatus={match.status} hasPrediction={!!savedPrediction || hasExactScore} />
            <BellNotification
              match={match}
              isBookmarked={favoriteMatchIds?.has(match.id)}
              onToggle={onToggleFavoriteMatch}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </div>

        {/* === TEAMS ROW: Crest Name  VS  Name Crest === */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 py-1">
          {/* Home team */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <TeamCrest team={match.homeTeam} large />
            <span className="text-xs sm:text-sm font-bold text-foreground uppercase leading-tight text-left break-words" data-testid="home-team-name">
              {match.homeTeam.shortName || match.homeTeam.name}
            </span>
          </div>

          {/* Score or VS */}
          <div className="flex-shrink-0 px-2 sm:px-3">
            {(isLive || isFinished) && match.score?.home !== null ? (
              <div className="flex items-center gap-1.5">
                <span className={`text-xl font-extrabold tabular-nums ${isLive ? 'text-red-400' : 'text-foreground'}`}>
                  {match.score.home}
                </span>
                <span className="text-sm text-muted-foreground font-medium">-</span>
                <span className={`text-xl font-extrabold tabular-nums ${isLive ? 'text-red-400' : 'text-foreground'}`}>
                  {match.score.away}
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold text-muted-foreground/60 uppercase tracking-wider">VS</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 justify-end">
            <span className="text-xs sm:text-sm font-bold text-foreground uppercase leading-tight text-right break-words" data-testid="away-team-name">
              {match.awayTeam.shortName || match.awayTeam.name}
            </span>
            <TeamCrest team={match.awayTeam} large />
          </div>
        </div>

        {/* === PREDICTION BARS (3 columns side by side — display only) === */}
        <PredictionBars
          votes={match.votes}
          selectedType={displayedSelection}
          locked={isLocked}
          dynamicPoints={match.dynamicPoints}
        />

        {/* === PREDICT MATCH BUTTON (opens Advanced modal) === */}
        {!isLocked && (
          <PredictMatchButton
            onClick={() => onAdvance(match.id)}
            disabled={isLocked}
          />
        )}

        {/* Locked banner */}
        {isLocked && (
          <PredictionLockedBanner lockReason={match.lockReason} />
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

  // Just select locally (no save to server) — used by prediction bars
  const handleLocalSelect = useCallback((matchId, prediction) => {
    const currentSaved = savedPredictions[matchId];
    // If tapping the same option that's already saved → deselect
    if (currentSaved === prediction) {
      setCurrentSelections((prev) => ({ ...prev, [matchId]: null }));
      return;
    }
    setCurrentSelections((prev) => ({ ...prev, [matchId]: prediction }));
  }, [savedPredictions]);

  const handleSelectPrediction = useCallback(async (matchId, prediction) => {
    const currentSaved = savedPredictions[matchId];
    
    // If tapping the same option that's already saved → REMOVE prediction
    if (currentSaved === prediction) {
      setLoadingMatches((prev) => ({ ...prev, [matchId]: true }));
      try {
        await deletePrediction(matchId);
        if (onPredictionSaved) onPredictionSaved(matchId, null);
        setCurrentSelections((prev) => { const n = { ...prev }; delete n[matchId]; return n; });
        toast.success('Prediction removed', { duration: 2000 });
      } catch (error) {
        console.error('[Prediction] Remove failed:', error);
        toast.error('Could not remove prediction', { description: 'Please try again.', duration: 3000 });
      } finally {
        setLoadingMatches((prev) => ({ ...prev, [matchId]: false }));
      }
      return;
    }

    // Auth check
    if (!isAuthenticated) {
      setPendingPrediction({ matchId, prediction });
      setShowAuthModal(true);
      return;
    }

    // Optimistic update: immediately show as saved
    const previousPrediction = currentSaved;
    if (onPredictionSaved) onPredictionSaved(matchId, prediction);
    setCurrentSelections((prev) => { const n = { ...prev }; delete n[matchId]; return n; });

    setLoadingMatches((prev) => ({ ...prev, [matchId]: true }));
    try {
      const result = await savePrediction(matchId, prediction);
      // Success — no toast notification (cleaner UX)
    } catch (error) {
      // Revert optimistic update on failure
      if (onPredictionSaved) onPredictionSaved(matchId, previousPrediction || null);
      console.error('[Prediction] Save failed:', error);
      toast.error('Could not save prediction', { description: 'Please try again.', duration: 3000 });
    } finally {
      setLoadingMatches((prev) => ({ ...prev, [matchId]: false }));
    }
  }, [savedPredictions, isAuthenticated, onPredictionSaved]);

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
      console.error('[Prediction] Remove failed:', error);
      toast.error('Could not remove prediction', { description: 'Please try again.', duration: 3000 });
    } finally {
      setLoadingMatches((prev) => ({ ...prev, [matchId]: false }));
    }
  }, [savedPredictions, onPredictionSaved, exactScoreMatchIds]);

  const handleNavigateMatch = useCallback((matchId) => {
    navigate(`/match/${matchId}`);
  }, [navigate]);

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
        console.error('[Prediction] Save failed:', error);
        toast.error('Could not save prediction', { description: 'Please try again.', duration: 3000 });
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

  // Group matches by competition for league sections
  const groupedMatches = useMemo(() => {
    const groups = {};
    const allMatches = matches || [];
    
    allMatches.forEach((match) => {
      const comp = match.competition || 'Other';
      if (!groups[comp]) {
        groups[comp] = {
          competition: comp,
          competitionEmblem: match.competitionEmblem || '',
          competitionCountry: match.competitionCountry || '',
          matches: [],
        };
      }
      groups[comp].matches.push(match);
    });

    // Sort groups: leagues with live matches first, then alphabetically
    return Object.values(groups).sort((a, b) => {
      const aHasLive = a.matches.some(m => m.status === 'LIVE');
      const bHasLive = b.matches.some(m => m.status === 'LIVE');
      if (aHasLive && !bHasLive) return -1;
      if (!aHasLive && bHasLive) return 1;
      return a.competition.localeCompare(b.competition);
    });
  }, [matches]);

  return (
    <>
      <div className="mt-4 sm:mt-5 space-y-5 max-w-3xl mx-auto" data-testid="match-list-container">
        {groupedMatches.map((group) => (
          <div key={group.competition} data-testid={`league-section-${group.competition}`}>
            {/* League Header */}
            <LeagueHeader
              competition={group.competition}
              competitionEmblem={group.competitionEmblem}
              competitionCountry={group.competitionCountry}
            />

            {/* Matches under this league */}
            <div className="flex flex-col gap-6 mt-2">
              {group.matches.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  currentSelection={currentSelections[match.id]}
                  savedPrediction={savedPredictions[match.id]}
                  onGuessIt={handleGuessIt}
                  onAdvance={handleAdvance}
                  isLoading={loadingMatches[match.id]}
                  prevScores={prevScores}
                  favoriteTeamIds={favoriteTeamIds}
                  onToggleFavorite={onToggleFavorite}
                  isAuthenticated={isAuthenticated}
                  favoriteMatchIds={favoriteMatchIds}
                  onToggleFavoriteMatch={onToggleFavoriteMatch}
                  hasExactScore={exactScoreMatchIds.has(match.id)}
                  onNavigateMatch={handleNavigateMatch}
                />
              ))}
            </div>
          </div>
        ))}

        {groupedMatches.length === 0 && (
          <div className="text-center py-8 text-muted-foreground" data-testid="no-matches-in-list">
            No matches to display.
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
        onQuickPredict={handleSelectPrediction}
      />
    </>
  );
};

export default MatchList;
