import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { TrendingUp, Loader2, Check, AlertCircle, RefreshCw, RotateCcw, Sparkles, Lock, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { savePrediction } from '@/services/predictions';
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
const StatusBadge = memo(({ status, statusDetail, matchMinute }) => {
  if (status === 'LIVE') {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30"
          data-testid="live-badge"
        >
          <Radio className="w-3 h-3 animate-pulse" />
          {statusDetail === 'HT' ? 'Half Time' : 'Live'}
        </span>
        {matchMinute && (
          <span className="text-[11px] font-bold text-red-400 tabular-nums" data-testid="match-minute">
            {matchMinute}
          </span>
        )}
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
const ScoreDisplay = memo(({ score, status, prevScore }) => {
  const homeChanged = prevScore && prevScore.home !== score.home;
  const awayChanged = prevScore && prevScore.away !== score.away;

  if (status === 'NOT_STARTED' || (score.home === null && score.away === null)) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[36px]" data-testid="score-display">
      <span
        className={`text-lg font-bold tabular-nums transition-all duration-500 ${
          homeChanged ? 'text-primary scale-125' : 'text-foreground'
        }`}
      >
        {score.home ?? 0}
      </span>
      <span className="text-xs text-muted-foreground">-</span>
      <span
        className={`text-lg font-bold tabular-nums transition-all duration-500 ${
          awayChanged ? 'text-primary scale-125' : 'text-foreground'
        }`}
      >
        {score.away ?? 0}
      </span>
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
      {team.flag || team.logo || '⚽'}
    </div>
  );
});
TeamCrest.displayName = 'TeamCrest';

// ============ Vote Button ============
const VoteButton = memo(({ type, votes, percentage, isSelected, onClick, disabled, locked }) => {
  const labels = { home: '1', draw: 'X', away: '2' };
  const isLocked = disabled || locked;

  return (
    <button
      onClick={() => !isLocked && onClick(type)}
      disabled={isLocked}
      data-selected={isSelected ? 'true' : 'false'}
      data-testid={`vote-btn-${type}`}
      className={`flex flex-col items-center justify-center min-w-[60px] md:min-w-[80px] px-2 md:px-3 py-2 rounded-lg transition-all duration-200 border ${
        isLocked
          ? 'opacity-40 cursor-not-allowed bg-muted border-border/30'
          : isSelected
            ? 'bg-primary/30 border-primary border-2 shadow-glow ring-2 ring-primary/30'
            : 'bg-vote-inactive border-transparent hover:bg-vote-inactive-hover hover:border-border cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-sm md:text-base font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
          {labels[type]}
        </span>
        {isSelected && !isLocked && (
          <span className="flex items-center justify-center w-3 h-3 md:w-4 md:h-4 rounded bg-primary/20">
            <TrendingUp className="w-2 h-2 md:w-3 md:h-3 text-primary" />
          </span>
        )}
      </div>
      <span className="text-sm md:text-base font-bold text-foreground">{votes.toLocaleString()}</span>
      <span className={`text-xs md:text-sm ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
        {percentage}%
      </span>
    </button>
  );
});
VoteButton.displayName = 'VoteButton';

// ============ GUESS IT Button ============
const GuessItButton = memo(({ currentSelection, savedPrediction, isLoading, onClick, locked }) => {
  const hasSelection = !!currentSelection;
  const hasSaved = !!savedPrediction;
  const isCurrentSaved = hasSaved && savedPrediction === currentSelection;
  const hasUnsavedChanges = hasSaved && currentSelection && savedPrediction !== currentSelection;

  const getButtonState = () => {
    if (locked) return { text: 'Closed', showCheck: false, showUpdate: false, isSaved: false, isLocked: true };
    if (isLoading) return { text: 'Saving...', showCheck: false, showUpdate: false, isSaved: false, isLocked: false };
    if (isCurrentSaved) return { text: 'Saved', showCheck: true, showUpdate: false, isSaved: true, isLocked: false };
    if (hasUnsavedChanges) return { text: 'Update', showCheck: false, showUpdate: true, isSaved: false, isLocked: false };
    return { text: 'GUESS IT', showCheck: false, showUpdate: false, isSaved: false, isLocked: false };
  };

  const state = getButtonState();
  const isDisabled = locked || !hasSelection || isLoading;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      data-testid="guess-it-btn"
      className={`
        relative min-w-[100px] md:min-w-[120px] h-[72px] md:h-[84px] rounded-xl font-bold text-sm md:text-base
        transition-all duration-300 transform
        ${state.isLocked
          ? 'bg-muted border-2 border-border text-muted-foreground cursor-not-allowed'
          : state.isSaved
            ? 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary/30'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105'
        }
        ${isDisabled && !state.isSaved && !state.isLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
      `}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        {state.isLocked ? (
          <Lock className="w-5 h-5" />
        ) : isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : state.showCheck ? (
          <Check className="w-5 h-5" />
        ) : state.showUpdate ? (
          <RefreshCw className="w-5 h-5" />
        ) : (
          <span className="text-lg font-bold">G</span>
        )}
        <span className="text-xs md:text-sm font-semibold">{state.text}</span>
      </div>
    </Button>
  );
});
GuessItButton.displayName = 'GuessItButton';

// ============ Refresh Button ============
const RefreshButton = memo(({ onClick, disabled, hasSelection }) => (
  <Button
    onClick={onClick}
    disabled={disabled || !hasSelection}
    variant="outline"
    data-testid="refresh-prediction-btn"
    className={`
      relative min-w-[70px] md:min-w-[80px] h-[72px] md:h-[84px] rounded-xl font-bold text-sm md:text-base
      transition-all duration-300 transform
      border-2 border-muted-foreground/30 hover:border-destructive/50
      bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive
      ${!hasSelection ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
    `}
  >
    <div className="flex flex-col items-center justify-center gap-1">
      <RotateCcw className="w-5 h-5" />
      <span className="text-xs md:text-sm font-semibold">Refresh</span>
    </div>
  </Button>
));
RefreshButton.displayName = 'RefreshButton';

// ============ Advance Button ============
const AdvanceButton = memo(({ onClick, disabled }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    variant="outline"
    data-testid="advance-prediction-btn"
    className={`
      relative min-w-[70px] md:min-w-[80px] h-[72px] md:h-[84px] rounded-xl font-bold text-sm md:text-base
      transition-all duration-300 transform
      border-2 border-amber-500/30 hover:border-amber-500
      bg-gradient-to-br from-amber-500/5 to-orange-500/10 
      hover:from-amber-500/20 hover:to-orange-500/20
      text-amber-600 dark:text-amber-400
      hover:scale-105 hover:shadow-lg hover:shadow-amber-500/20
    `}
  >
    <div className="flex flex-col items-center justify-center gap-1">
      <Sparkles className="w-5 h-5" />
      <span className="text-xs md:text-sm font-semibold">Advance</span>
    </div>
  </Button>
));
AdvanceButton.displayName = 'AdvanceButton';

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

// ============ Match Row ============
const MatchRow = ({
  match,
  currentSelection,
  savedPrediction,
  onSelectPrediction,
  onGuessIt,
  onRefresh,
  onAdvance,
  isLoading,
  prevScores,
  viewMode = 'grid',
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

  const isGrid = viewMode === 'grid';

  return (
    <div
      className={`bg-card/50 hover:bg-card rounded-xl border transition-all duration-200 animate-slide-in overflow-hidden ${
        match.status === 'LIVE' ? 'border-red-500/30 bg-red-500/5' : 'border-border/50 hover:border-border'
      } ${isGrid ? 'px-3 py-3.5' : 'px-4 py-5'}`}
      data-testid={`match-row-${match.id}`}
      data-match-id={match.id}
    >
      {/* Match Meta */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <StatusBadge status={match.status} statusDetail={match.statusDetail} matchMinute={match.matchMinute} />
        <span className={isGrid ? 'text-xs' : ''}>{match.dateTime}</span>
        <span className="text-border">|</span>
        <span className="truncate">{match.competition}</span>
      </div>

      {/* Locked Banner */}
      {isLocked && <div className="mb-2"><PredictionLockedBanner lockReason={match.lockReason} /></div>}

      {/* ======= LIST VIEW (full-width horizontal) ======= */}
      {!isGrid && (
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Teams + Score */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground w-3 text-right flex-shrink-0" data-testid="team-number-home">1</span>
                <TeamCrest team={match.homeTeam} />
                <span className="text-sm md:text-base font-medium text-foreground truncate max-w-[180px] md:max-w-[280px]">
                  {match.homeTeam.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground w-3 text-right flex-shrink-0" data-testid="team-number-away">2</span>
                <TeamCrest team={match.awayTeam} />
                <span className="text-sm md:text-base font-medium text-foreground truncate max-w-[180px] md:max-w-[280px]">
                  {match.awayTeam.name}
                </span>
              </div>
            </div>
            <ScoreDisplay score={match.score} status={match.status} prevScore={prevScores?.[match.id]} />
          </div>

          {/* Vote Buttons */}
          <div className="flex items-center gap-1 md:gap-2">
            <VoteButton type="home" votes={match.votes.home.count} percentage={match.votes.home.percentage} isSelected={displayedSelection === 'home'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
            <VoteButton type="draw" votes={match.votes.draw.count} percentage={match.votes.draw.percentage} isSelected={displayedSelection === 'draw'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
            <VoteButton type="away" votes={match.votes.away.count} percentage={match.votes.away.percentage} isSelected={displayedSelection === 'away'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 md:gap-2">
            <GuessItButton currentSelection={displayedSelection} savedPrediction={savedPrediction} isLoading={isLoading} onClick={() => onGuessIt(match.id)} locked={isLocked} />
            <AdvanceButton onClick={() => onAdvance(match.id)} disabled={isLoading || isLocked} />
            <RefreshButton onClick={() => onRefresh(match.id)} disabled={isLoading || isLocked} hasSelection={!!displayedSelection} />
          </div>
        </div>
      )}

      {/* ======= GRID VIEW (compact stacked) ======= */}
      {isGrid && (
        <div className="space-y-2.5">
          {/* Teams + Score Row */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground w-2.5 text-right flex-shrink-0" data-testid="team-number-home">1</span>
                <TeamCrest team={match.homeTeam} />
                <span className="text-xs font-medium text-foreground truncate">{match.homeTeam.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground w-2.5 text-right flex-shrink-0" data-testid="team-number-away">2</span>
                <TeamCrest team={match.awayTeam} />
                <span className="text-xs font-medium text-foreground truncate">{match.awayTeam.name}</span>
              </div>
            </div>
            <ScoreDisplay score={match.score} status={match.status} prevScore={prevScores?.[match.id]} />
          </div>

          {/* Vote + Actions Row */}
          <div className="flex items-center gap-1.5">
            {/* Compact votes */}
            <div className="flex items-center gap-1 flex-1">
              <VoteButton type="home" votes={match.votes.home.count} percentage={match.votes.home.percentage} isSelected={displayedSelection === 'home'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
              <VoteButton type="draw" votes={match.votes.draw.count} percentage={match.votes.draw.percentage} isSelected={displayedSelection === 'draw'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
              <VoteButton type="away" votes={match.votes.away.count} percentage={match.votes.away.percentage} isSelected={displayedSelection === 'away'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
            </div>
            {/* Compact actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <GuessItButton currentSelection={displayedSelection} savedPrediction={savedPrediction} isLoading={isLoading} onClick={() => onGuessIt(match.id)} locked={isLocked} />
              <AdvanceButton onClick={() => onAdvance(match.id)} disabled={isLoading || isLocked} />
              <RefreshButton onClick={() => onRefresh(match.id)} disabled={isLoading || isLocked} hasSelection={!!displayedSelection} />
            </div>
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className={`flex items-center gap-3 mt-3 pt-2.5 border-t border-border/30 ${isGrid ? 'text-[11px]' : 'text-xs md:text-sm'}`}>
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
        {hasUnsavedChanges && (
          <span className="text-yellow-500 font-medium flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Unsaved
          </span>
        )}
      </div>
    </div>
  );
};

// ============ Main MatchList ============
export const MatchList = ({ matches, savedPredictions = {}, onPredictionSaved, activeLeague, viewMode = 'grid' }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [currentSelections, setCurrentSelections] = useState({});
  const [loadingMatches, setLoadingMatches] = useState({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPrediction, setPendingPrediction] = useState(null);
  const [prevScores, setPrevScores] = useState({});

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

  const handleRefresh = useCallback((matchId) => {
    setCurrentSelections((prev) => ({ ...prev, [matchId]: null }));
    toast.info('Selection cleared', { description: 'Your selection has been reset.', duration: 2000 });
  }, []);

  const handleAdvance = useCallback(() => {
    toast.info('Coming Soon!', {
      description: 'Advanced predictions will be available soon.',
      duration: 3000,
    });
  }, []);

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

      setLoadingMatches((prev) => ({ ...prev, [matchId]: true }));
      try {
        const result = await savePrediction(matchId, selection);
        setCurrentSelections((prev) => {
          const next = { ...prev };
          delete next[matchId];
          return next;
        });
        if (onPredictionSaved) onPredictionSaved(matchId, selection);
        toast.success(result.is_new ? 'Prediction saved!' : 'Prediction updated!', {
          description: `You predicted: ${selection === 'home' ? 'Home Win (1)' : selection === 'draw' ? 'Draw (X)' : 'Away Win (2)'}`,
          duration: 2000,
        });
      } catch (error) {
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

  // Filter only for live filter - other filtering is done at the API level now
  const displayMatches = activeLeague === 'live' ? matches.filter((m) => m.status === 'LIVE') : matches;

  return (
    <>
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">All Matches</h3>
        <div
          className={`transition-all duration-300 ${
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
              : 'flex flex-col gap-3'
          }`}
          data-testid="match-list-container"
          data-view-mode={viewMode}
        >
          {displayMatches.map((match) => (
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
              viewMode={viewMode}
            />
          ))}
        </div>
        {displayMatches.length === 0 && (
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
    </>
  );
};

export default MatchList;
