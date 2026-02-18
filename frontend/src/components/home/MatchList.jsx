import { useState, useCallback, memo } from 'react';
import { TrendingUp, Loader2, Check, AlertCircle, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
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

// Vote button component
const VoteButton = memo(({ type, votes, percentage, isSelected, onClick, disabled }) => {
  const labels = { home: '1', draw: 'X', away: '2' };

  return (
    <button
      onClick={() => !disabled && onClick(type)}
      disabled={disabled}
      data-selected={isSelected ? "true" : "false"}
      data-testid={`vote-btn-${type}`}
      className={`flex flex-col items-center justify-center min-w-[60px] md:min-w-[80px] px-2 md:px-3 py-2 rounded-lg transition-all duration-200 border ${
        disabled ? 'opacity-50 cursor-not-allowed' :
        isSelected
          ? 'bg-primary/30 border-primary border-2 shadow-glow ring-2 ring-primary/30'
          : 'bg-vote-inactive border-transparent hover:bg-vote-inactive-hover hover:border-border cursor-pointer'
      }`}
    >
      {/* Label with badge */}
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-sm md:text-base font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
          {labels[type]}
        </span>
        {isSelected && (
          <span className="flex items-center justify-center w-3 h-3 md:w-4 md:h-4 rounded bg-primary/20">
            <TrendingUp className="w-2 h-2 md:w-3 md:h-3 text-primary" />
          </span>
        )}
      </div>
      
      {/* Vote count */}
      <span className="text-sm md:text-base font-bold text-foreground">
        {votes.toLocaleString()}
      </span>
      
      {/* Percentage */}
      <span className={`text-xs md:text-sm ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
        {percentage}%
      </span>
    </button>
  );
});

VoteButton.displayName = 'VoteButton';

/**
 * GUESS IT Button Component
 * 
 * States:
 * 1. No selection, no saved → Disabled "GUESS IT"
 * 2. Has selection, no saved → Active "GUESS IT" 
 * 3. Has selection, saved matches selection → "Saved" (confirmed)
 * 4. Has selection, saved differs from selection → "GUESS IT" (update mode)
 */
const GuessItButton = memo(({ 
  currentSelection,
  savedPrediction,
  isLoading, 
  onClick, 
}) => {
  // Determine button state
  const hasSelection = !!currentSelection;
  const hasSaved = !!savedPrediction;
  const isCurrentSaved = hasSaved && savedPrediction === currentSelection;
  const hasUnsavedChanges = hasSaved && currentSelection && savedPrediction !== currentSelection;
  
  // Button text and appearance logic
  const getButtonState = () => {
    if (isLoading) {
      return { text: 'Saving...', showCheck: false, showUpdate: false, isSaved: false };
    }
    if (isCurrentSaved) {
      return { text: 'Saved', showCheck: true, showUpdate: false, isSaved: true };
    }
    if (hasUnsavedChanges) {
      return { text: 'Update', showCheck: false, showUpdate: true, isSaved: false };
    }
    return { text: 'GUESS IT', showCheck: false, showUpdate: false, isSaved: false };
  };
  
  const state = getButtonState();
  const isDisabled = !hasSelection || isLoading;
  
  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        relative min-w-[100px] md:min-w-[120px] h-[72px] md:h-[84px] rounded-xl font-bold text-sm md:text-base
        transition-all duration-300 transform
        ${state.isSaved 
          ? 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary/30' 
          : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105'
        }
        ${isDisabled && !state.isSaved ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
        ${isLoading ? 'cursor-wait' : ''}
      `}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : state.showCheck ? (
          <Check className="w-5 h-5" />
        ) : state.showUpdate ? (
          <RefreshCw className="w-5 h-5" />
        ) : (
          <span className="text-lg font-bold">G</span>
        )}
        <span className="text-xs md:text-sm font-semibold">
          {state.text}
        </span>
      </div>
    </Button>
  );
});

GuessItButton.displayName = 'GuessItButton';

/**
 * Refresh Button Component
 * Clears the current selection for the match
 */
const RefreshButton = memo(({ onClick, disabled, hasSelection }) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || !hasSelection}
      variant="outline"
      className={`
        relative min-w-[70px] md:min-w-[80px] h-[72px] md:h-[84px] rounded-xl font-bold text-sm md:text-base
        transition-all duration-300 transform
        border-2 border-muted-foreground/30 hover:border-destructive/50
        bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive
        ${!hasSelection ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
      `}
      data-testid="refresh-prediction-btn"
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <RotateCcw className="w-5 h-5" />
        <span className="text-xs md:text-sm font-semibold">Refresh</span>
      </div>
    </Button>
  );
});

RefreshButton.displayName = 'RefreshButton';

/**
 * Advance Button Component
 * Placeholder for advanced prediction features (score prediction, etc.)
 */
const AdvanceButton = memo(({ onClick, disabled }) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="outline"
      className={`
        relative min-w-[70px] md:min-w-[80px] h-[72px] md:h-[84px] rounded-xl font-bold text-sm md:text-base
        transition-all duration-300 transform
        border-2 border-amber-500/30 hover:border-amber-500
        bg-gradient-to-br from-amber-500/5 to-orange-500/10 
        hover:from-amber-500/20 hover:to-orange-500/20
        text-amber-600 dark:text-amber-400
        hover:scale-105 hover:shadow-lg hover:shadow-amber-500/20
      `}
      data-testid="advance-prediction-btn"
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <Sparkles className="w-5 h-5" />
        <span className="text-xs md:text-sm font-semibold">Advance</span>
      </div>
    </Button>
  );
});

AdvanceButton.displayName = 'AdvanceButton';

// Auth Required Modal
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
        <Button 
          className="w-full bg-primary hover:bg-primary/90"
          onClick={onLogin}
        >
          Sign In
        </Button>
        <Button 
          variant="outline" 
          className="w-full"
          onClick={onRegister}
        >
          Create Account
        </Button>
        <Button 
          variant="ghost" 
          className="w-full text-muted-foreground"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </DialogContent>
  </Dialog>
));

AuthRequiredModal.displayName = 'AuthRequiredModal';

// Match Row Component
const MatchRow = ({ 
  match, 
  currentSelection,
  savedPrediction,
  onSelectPrediction, 
  onGuessIt,
  onRefresh,
  onAdvance,
  isLoading,
}) => {
  // The displayed selection is current if set, otherwise fall back to saved
  const displayedSelection = currentSelection !== undefined ? currentSelection : savedPrediction;
  
  const getMostPicked = () => {
    const votes = match.votes;
    if (votes.home.percentage >= votes.draw.percentage && votes.home.percentage >= votes.away.percentage) {
      return 'home';
    }
    if (votes.draw.percentage >= votes.home.percentage && votes.draw.percentage >= votes.away.percentage) {
      return 'draw';
    }
    return 'away';
  };

  const mostPicked = getMostPicked();
  const mostPickedLabel = mostPicked === 'home' ? match.homeTeam.shortName || 'Home' : 
                          mostPicked === 'away' ? match.awayTeam.shortName || 'Away' : 'Draw';

  // Show saved indicator in footer
  const isCurrentSaved = savedPrediction && savedPrediction === displayedSelection;
  const hasUnsavedChanges = savedPrediction && displayedSelection && savedPrediction !== displayedSelection;

  return (
    <div className="bg-card/50 hover:bg-card rounded-xl px-4 py-5 border border-border/50 hover:border-border transition-all duration-200 animate-slide-in">
      {/* Match Meta */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <span>{match.dateTime}</span>
        <span className="text-border">|</span>
        <span>{match.sport}</span>
        <span className="text-border">|</span>
        <span className="truncate">{match.competition}</span>
      </div>

      {/* Match Content */}
      <div className="flex items-center justify-between gap-2 md:gap-4">
        {/* Teams */}
        <div className="flex flex-col gap-2 min-w-0 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full bg-secondary text-sm md:text-base flex-shrink-0">
              {match.homeTeam.flag || match.homeTeam.logo || '⚽'}
            </div>
            <span className="text-sm md:text-base font-medium text-foreground truncate max-w-[100px] md:max-w-none">
              {match.homeTeam.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full bg-secondary text-sm md:text-base flex-shrink-0">
              {match.awayTeam.flag || match.awayTeam.logo || '⚽'}
            </div>
            <span className="text-sm md:text-base font-medium text-foreground truncate max-w-[100px] md:max-w-none">
              {match.awayTeam.name}
            </span>
          </div>
        </div>

        {/* Vote Buttons */}
        <div className="flex items-center gap-1 md:gap-2">
          <VoteButton
            type="home"
            votes={match.votes.home.count}
            percentage={match.votes.home.percentage}
            isSelected={displayedSelection === 'home'}
            onClick={(type) => onSelectPrediction(match.id, type)}
            disabled={isLoading}
          />
          <VoteButton
            type="draw"
            votes={match.votes.draw.count}
            percentage={match.votes.draw.percentage}
            isSelected={displayedSelection === 'draw'}
            onClick={(type) => onSelectPrediction(match.id, type)}
            disabled={isLoading}
          />
          <VoteButton
            type="away"
            votes={match.votes.away.count}
            percentage={match.votes.away.percentage}
            isSelected={displayedSelection === 'away'}
            onClick={(type) => onSelectPrediction(match.id, type)}
            disabled={isLoading}
          />
        </div>

        {/* Action Buttons: GUESS IT, Advance, Refresh */}
        <div className="flex items-center gap-1 md:gap-2">
          <GuessItButton
            currentSelection={displayedSelection}
            savedPrediction={savedPrediction}
            isLoading={isLoading}
            onClick={() => onGuessIt(match.id)}
          />
          <AdvanceButton
            onClick={() => onAdvance(match.id)}
            disabled={isLoading}
          />
          <RefreshButton
            onClick={() => onRefresh(match.id)}
            disabled={isLoading}
            hasSelection={!!displayedSelection}
          />
        </div>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30 text-xs md:text-sm">
        <span className="text-muted-foreground">
          Total votes: <span className="text-foreground font-medium">{match.totalVotes.toLocaleString()}</span>
        </span>
        <span className="text-muted-foreground">
          Most picked: <span className="text-primary font-medium">{mostPickedLabel}</span>
        </span>
        
        {/* Saved status indicator */}
        {isCurrentSaved && (
          <span className="text-primary font-medium flex items-center gap-1">
            <Check className="w-3 h-3" />
            Your pick: {displayedSelection === 'home' ? '1' : displayedSelection === 'draw' ? 'X' : '2'}
          </span>
        )}
        {hasUnsavedChanges && (
          <span className="text-yellow-500 font-medium flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Unsaved change
          </span>
        )}
      </div>
    </div>
  );
};

// Main MatchList Component
export const MatchList = ({ 
  matches, 
  savedPredictions = {}, 
  onPredictionSaved,
  activeLeague 
}) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Local state for current selections (can differ from saved)
  // Key: matchId, Value: prediction type or null
  const [currentSelections, setCurrentSelections] = useState({});
  const [loadingMatches, setLoadingMatches] = useState({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPrediction, setPendingPrediction] = useState(null);

  // Handle selecting a prediction option
  const handleSelectPrediction = useCallback((matchId, prediction) => {
    setCurrentSelections(prev => {
      const current = prev[matchId];
      // If clicking same option, toggle it off (set to null)
      // Otherwise set the new selection
      if (current === prediction) {
        return { ...prev, [matchId]: null };
      }
      return { ...prev, [matchId]: prediction };
    });
  }, []);

  // Handle Refresh - clears the current selection
  const handleRefresh = useCallback((matchId) => {
    setCurrentSelections(prev => ({
      ...prev,
      [matchId]: null
    }));
    toast.info('Selection cleared', {
      description: 'Your selection has been reset.',
      duration: 2000,
    });
  }, []);

  // Handle Advance - placeholder for future advanced prediction features
  const handleAdvance = useCallback((matchId) => {
    toast.info('Coming Soon!', {
      description: 'Advanced predictions (score predictions, detailed analysis) will be available soon.',
      duration: 3000,
    });
  }, []);

  // Get the effective current selection for a match
  // Priority: explicit current selection > saved prediction
  const getEffectiveSelection = useCallback((matchId) => {
    // If user has made a selection (even null to clear), use it
    if (matchId in currentSelections) {
      return currentSelections[matchId];
    }
    // Otherwise fall back to saved prediction
    return savedPredictions[matchId] || null;
  }, [currentSelections, savedPredictions]);

  // Handle GUESS IT button click
  const handleGuessIt = useCallback(async (matchId) => {
    const selection = getEffectiveSelection(matchId);
    
    // Validation: Must have selection
    if (!selection) {
      toast.error('Please select an option first', {
        description: 'Choose 1, X, or 2 before making your prediction.',
        duration: 3000,
      });
      return;
    }

    // Check if selection is same as saved (no need to save again)
    if (savedPredictions[matchId] === selection) {
      toast.info('Prediction already saved', {
        description: 'Your current selection is already saved.',
        duration: 2000,
      });
      return;
    }

    // If not authenticated, show modal and save pending prediction
    if (!isAuthenticated) {
      setPendingPrediction({ matchId, prediction: selection });
      setShowAuthModal(true);
      return;
    }

    // Save prediction
    setLoadingMatches(prev => ({ ...prev, [matchId]: true }));
    
    try {
      const result = await savePrediction(matchId, selection);
      
      // Clear local selection since it's now saved
      setCurrentSelections(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      
      // Notify parent of saved prediction
      if (onPredictionSaved) {
        onPredictionSaved(matchId, selection);
      }
      
      toast.success(result.is_new ? 'Prediction saved!' : 'Prediction updated!', {
        description: `You predicted: ${selection === 'home' ? 'Home Win (1)' : selection === 'draw' ? 'Draw (X)' : 'Away Win (2)'}`,
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to save prediction:', error);
      toast.error('Failed to save prediction', {
        description: error.message,
        duration: 3000,
      });
    } finally {
      setLoadingMatches(prev => ({ ...prev, [matchId]: false }));
    }
  }, [getEffectiveSelection, savedPredictions, isAuthenticated, onPredictionSaved]);

  // Handle auth modal actions
  const handleAuthModalLogin = useCallback(() => {
    if (pendingPrediction) {
      sessionStorage.setItem('pendingPrediction', JSON.stringify(pendingPrediction));
    }
    setShowAuthModal(false);
    navigate('/login');
  }, [pendingPrediction, navigate]);

  const handleAuthModalRegister = useCallback(() => {
    if (pendingPrediction) {
      sessionStorage.setItem('pendingPrediction', JSON.stringify(pendingPrediction));
    }
    setShowAuthModal(false);
    navigate('/register');
  }, [pendingPrediction, navigate]);

  const handleCloseAuthModal = useCallback(() => {
    setShowAuthModal(false);
    setPendingPrediction(null);
  }, []);

  // Filter matches based on active league
  const filteredMatches = matches.filter(match => {
    if (activeLeague === 'today') {
      return match.dateTime.toLowerCase().includes('today');
    }
    if (activeLeague === 'live') {
      return match.status === 'live';
    }
    if (activeLeague === 'upcoming') {
      return match.status === 'upcoming';
    }
    if (activeLeague === 'ucl') {
      return match.competition.toLowerCase().includes('champions') || 
             match.competition.toLowerCase().includes('ucl');
    }
    if (activeLeague === 'premier-league') {
      return match.competition.toLowerCase().includes('premier');
    }
    if (activeLeague === 'la-liga') {
      return match.competition.toLowerCase().includes('la liga');
    }
    if (activeLeague === 'serie-a') {
      return match.competition.toLowerCase().includes('serie');
    }
    if (activeLeague === 'international') {
      return match.competition.toLowerCase().includes('international') ||
             match.competition.toLowerCase().includes('european');
    }
    if (activeLeague === 'azerbaijan-league') {
      return match.competition.toLowerCase().includes('azerbaijan');
    }
    return true;
  });

  // If no matches found for the filter, show all matches
  const displayMatches = filteredMatches.length > 0 ? filteredMatches : matches;

  return (
    <>
      <div className="mt-6 space-y-3">
        <h3 className="text-lg font-semibold text-foreground mb-4">All Matches</h3>
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
          />
        ))}
      </div>

      {/* Auth Required Modal */}
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
