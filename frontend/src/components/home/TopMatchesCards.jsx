import { useState, useCallback, memo } from 'react';
import { TrendingUp, Loader2, Check, AlertCircle, RefreshCw, RotateCcw, Sparkles, Lock, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { savePrediction } from '@/services/predictions';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============ Status Badge (compact) ============
const StatusBadgeCompact = memo(({ status, statusDetail, matchMinute }) => {
  if (status === 'LIVE') {
    return (
      <div className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30" data-testid="live-badge-compact">
          <Radio className="w-2.5 h-2.5 animate-pulse" />
          {statusDetail === 'HT' ? 'HT' : 'Live'}
        </span>
        {matchMinute && (
          <span className="text-[10px] font-bold text-red-400 tabular-nums" data-testid="match-minute-compact">
            {matchMinute}
          </span>
        )}
      </div>
    );
  }
  if (status === 'FINISHED') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-muted text-muted-foreground border border-border" data-testid="ft-badge-compact">
        FT
      </span>
    );
  }
  return null;
});
StatusBadgeCompact.displayName = 'StatusBadgeCompact';

// ============ Score Display (compact) ============
const ScoreCompact = memo(({ score, status }) => {
  if (status === 'NOT_STARTED' || (score.home === null && score.away === null)) return null;
  return (
    <div className="flex items-center gap-1 text-sm font-bold tabular-nums" data-testid="score-compact">
      <span className="text-foreground">{score.home ?? 0}</span>
      <span className="text-muted-foreground">-</span>
      <span className="text-foreground">{score.away ?? 0}</span>
    </div>
  );
});
ScoreCompact.displayName = 'ScoreCompact';

// ============ Team Crest (compact) ============
const TeamCrestCompact = memo(({ team }) => {
  if (team.crest) {
    return (
      <img
        src={team.crest}
        alt={team.name}
        className="w-5 h-5 rounded-full object-contain bg-secondary flex-shrink-0"
        onError={(e) => {
          e.target.style.display = 'none';
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  }
  return (
    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-xs">
      {team.flag || team.logo || '⚽'}
    </div>
  );
});
TeamCrestCompact.displayName = 'TeamCrestCompact';

// ============ Vote Button (compact) ============
const VoteButton = memo(({ type, votes, percentage, isSelected, onClick, disabled, locked }) => {
  const labels = { home: '1', draw: 'X', away: '2' };
  const isLocked = disabled || locked;

  return (
    <button
      onClick={() => !isLocked && onClick(type)}
      disabled={isLocked}
      data-selected={isSelected ? 'true' : 'false'}
      data-testid={`vote-btn-compact-${type}`}
      className={`flex flex-col items-center justify-center min-w-[50px] px-2 py-1.5 rounded-lg transition-all duration-200 border ${
        isLocked
          ? 'opacity-40 cursor-not-allowed bg-muted border-border/30'
          : isSelected
            ? 'bg-primary/30 border-primary border-2 shadow-glow ring-2 ring-primary/30'
            : 'bg-vote-inactive border-transparent hover:bg-vote-inactive-hover cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
          {labels[type]}
        </span>
        {isSelected && !isLocked && <TrendingUp className="w-2.5 h-2.5 text-primary" />}
      </div>
      <span className="text-sm font-bold text-foreground">{votes.toLocaleString()}</span>
      <span className={`text-xs ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>{percentage}%</span>
    </button>
  );
});
VoteButton.displayName = 'VoteButton';

// ============ GUESS IT Button (compact) ============
const GuessItButtonCompact = memo(({ currentSelection, savedPrediction, isLoading, onClick, locked }) => {
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
      size="sm"
      data-testid="guess-it-btn-compact"
      className={`
        relative min-w-[80px] h-[60px] rounded-lg font-bold text-xs
        transition-all duration-300 transform
        ${state.isLocked
          ? 'bg-muted border-2 border-border text-muted-foreground cursor-not-allowed'
          : state.isSaved
            ? 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary/30'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg hover:scale-105'
        }
        ${isDisabled && !state.isSaved && !state.isLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
      `}
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        {state.isLocked ? (
          <Lock className="w-4 h-4" />
        ) : isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : state.showCheck ? (
          <Check className="w-4 h-4" />
        ) : state.showUpdate ? (
          <RefreshCw className="w-4 h-4" />
        ) : (
          <span className="text-sm font-bold">G</span>
        )}
        <span className="text-[10px] font-semibold">{state.text}</span>
      </div>
    </Button>
  );
});
GuessItButtonCompact.displayName = 'GuessItButtonCompact';

// ============ Refresh Button (compact) ============
const RefreshButtonCompact = memo(({ onClick, disabled, hasSelection }) => (
  <Button
    onClick={onClick}
    disabled={disabled || !hasSelection}
    variant="outline"
    size="sm"
    data-testid="refresh-prediction-compact-btn"
    className={`
      relative min-w-[55px] h-[60px] rounded-lg font-bold text-xs
      transition-all duration-300 transform
      border-2 border-muted-foreground/30 hover:border-destructive/50
      bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive
      ${!hasSelection ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
    `}
  >
    <div className="flex flex-col items-center justify-center gap-0.5">
      <RotateCcw className="w-4 h-4" />
      <span className="text-[10px] font-semibold">Refresh</span>
    </div>
  </Button>
));
RefreshButtonCompact.displayName = 'RefreshButtonCompact';

// ============ Advance Button (compact) ============
const AdvanceButtonCompact = memo(({ onClick, disabled }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    variant="outline"
    size="sm"
    data-testid="advance-prediction-compact-btn"
    className={`
      relative min-w-[55px] h-[60px] rounded-lg font-bold text-xs
      transition-all duration-300 transform
      border-2 border-amber-500/30 hover:border-amber-500
      bg-gradient-to-br from-amber-500/5 to-orange-500/10 
      hover:from-amber-500/20 hover:to-orange-500/20
      text-amber-600 dark:text-amber-400
      hover:scale-105 hover:shadow-md hover:shadow-amber-500/20
    `}
  >
    <div className="flex flex-col items-center justify-center gap-0.5">
      <Sparkles className="w-4 h-4" />
      <span className="text-[10px] font-semibold">Advance</span>
    </div>
  </Button>
));
AdvanceButtonCompact.displayName = 'AdvanceButtonCompact';

// ============ Auth Modal ============
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
        <Button className="w-full bg-primary hover:bg-primary/90" onClick={onLogin}>Sign In</Button>
        <Button variant="outline" className="w-full" onClick={onRegister}>Create Account</Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>Cancel</Button>
      </div>
    </DialogContent>
  </Dialog>
));
AuthRequiredModal.displayName = 'AuthRequiredModal';

// ============ Team Display ============
const TeamDisplay = memo(({ team, number }) => (
  <div className="flex items-center gap-1.5 min-w-0">
    <span className="text-[10px] font-semibold text-muted-foreground w-2.5 text-right flex-shrink-0" data-testid={`team-number-${number}`}>{number}</span>
    <TeamCrestCompact team={team} />
    <span className="text-xs font-medium text-foreground truncate">{team.name}</span>
  </div>
));
TeamDisplay.displayName = 'TeamDisplay';

// ============ Top Match Card ============
const TopMatchCard = ({
  match,
  currentSelection,
  savedPrediction,
  onSelectPrediction,
  onGuessIt,
  onRefresh,
  onAdvance,
  isLoading,
}) => {
  const displayedSelection = currentSelection !== undefined ? currentSelection : savedPrediction;
  const isLocked = match.predictionLocked;
  const isCurrentSaved = savedPrediction && savedPrediction === displayedSelection;
  const hasUnsavedChanges = savedPrediction && displayedSelection && savedPrediction !== displayedSelection;

  return (
    <div
      className={`flex-1 min-w-0 bg-card rounded-xl p-4 border transition-all duration-300 animate-scale-in overflow-hidden ${
        match.status === 'LIVE' ? 'border-red-500/30 bg-red-500/5' : 'border-border hover:border-border-hover'
      }`}
      data-testid={`top-match-card-${match.id}`}
      data-match-id={match.id}
    >
      {/* Meta */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <StatusBadgeCompact status={match.status} statusDetail={match.statusDetail} matchMinute={match.matchMinute} />
        <span className="flex-shrink-0">{match.dateTime}</span>
        <span className="mx-1 flex-shrink-0">|</span>
        <span className="truncate">{match.competition}</span>
      </div>

      {/* Locked indicator */}
      {isLocked && (
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-medium mb-2" data-testid="prediction-locked-compact">
          <Lock className="w-2.5 h-2.5" />
          <span>{match.lockReason || 'Prediction closed'}</span>
        </div>
      )}

      {/* Content Row */}
      <div className="flex items-center gap-2">
        {/* Teams + Score */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <TeamDisplay team={match.homeTeam} number={1} />
            <TeamDisplay team={match.awayTeam} number={2} />
          </div>
          <ScoreCompact score={match.score} status={match.status} />
        </div>

        {/* Votes */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <VoteButton type="home" votes={match.votes.home.count} percentage={match.votes.home.percentage} isSelected={displayedSelection === 'home'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
          <VoteButton type="draw" votes={match.votes.draw.count} percentage={match.votes.draw.percentage} isSelected={displayedSelection === 'draw'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
          <VoteButton type="away" votes={match.votes.away.count} percentage={match.votes.away.percentage} isSelected={displayedSelection === 'away'} onClick={(type) => onSelectPrediction(match.id, type)} disabled={isLoading} locked={isLocked} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <GuessItButtonCompact currentSelection={displayedSelection} savedPrediction={savedPrediction} isLoading={isLoading} onClick={() => onGuessIt(match.id)} locked={isLocked} />
          <AdvanceButtonCompact onClick={() => onAdvance(match.id)} disabled={isLoading || isLocked} />
          <RefreshButtonCompact onClick={() => onRefresh(match.id)} disabled={isLoading || isLocked} hasSelection={!!displayedSelection} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50 text-xs">
        <span className="text-muted-foreground">
          Total votes: <span className="text-foreground font-medium">{match.totalVotes.toLocaleString()}</span>
        </span>
        {isCurrentSaved ? (
          <span className="text-primary font-medium flex items-center gap-1">
            <Check className="w-3 h-3" />
            Your pick: {displayedSelection === 'home' ? '1' : displayedSelection === 'draw' ? 'X' : '2'}
          </span>
        ) : hasUnsavedChanges ? (
          <span className="text-yellow-500 font-medium flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Unsaved
          </span>
        ) : (
          <span className="text-muted-foreground">
            Most picked: <span className="text-primary font-medium">{match.mostPicked}</span>
          </span>
        )}
      </div>
    </div>
  );
};

// ============ Main Component ============
export const TopMatchesCards = ({ matches, savedPredictions = {}, onPredictionSaved, viewMode = 'grid' }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [currentSelections, setCurrentSelections] = useState({});
  const [loadingMatches, setLoadingMatches] = useState({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPrediction, setPendingPrediction] = useState(null);

  const featuredMatches = matches.filter((m) => m.featured).slice(0, 2);

  const handleSelectPrediction = useCallback((matchId, prediction) => {
    setCurrentSelections((prev) => {
      if (prev[matchId] === prediction) return { ...prev, [matchId]: null };
      return { ...prev, [matchId]: prediction };
    });
  }, []);

  const handleRefresh = useCallback((matchId) => {
    setCurrentSelections((prev) => ({ ...prev, [matchId]: null }));
    toast.info('Selection cleared', { duration: 2000 });
  }, []);

  const handleAdvance = useCallback(() => {
    toast.info('Coming Soon!', { description: 'Advanced predictions will be available soon.', duration: 3000 });
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
        toast.error('Please select an option first', { duration: 3000 });
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
        toast.success(result.is_new ? 'Prediction saved!' : 'Prediction updated!', { duration: 2000 });
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

  if (featuredMatches.length === 0) return null;

  return (
    <>
      <div className={`mt-4 transition-all duration-300 ${
        viewMode === 'list' ? 'flex flex-col gap-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'
      }`}>
        {featuredMatches.map((match) => (
          <TopMatchCard
            key={match.id}
            match={match}
            currentSelection={currentSelections[match.id]}
            savedPrediction={savedPredictions[match.id]}
            onSelectPrediction={handleSelectPrediction}
            onGuessIt={handleGuessIt}
            onRefresh={handleRefresh}
            onAdvance={handleAdvance}
            isLoading={loadingMatches[match.id]}
          />
        ))}
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

export default TopMatchesCards;
