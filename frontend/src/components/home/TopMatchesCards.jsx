import { useState, useCallback, memo } from 'react';
import { TrendingUp, Loader2, Check, AlertCircle, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
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

// Vote button component for featured cards
const VoteButton = memo(({ type, votes, percentage, isSelected, onClick, disabled }) => {
  const labels = { home: '1', draw: 'X', away: '2' };

  return (
    <button
      onClick={() => !disabled && onClick(type)}
      disabled={disabled}
      data-selected={isSelected ? "true" : "false"}
      data-testid={`vote-btn-compact-${type}`}
      className={`flex flex-col items-center justify-center min-w-[50px] px-2 py-1.5 rounded-lg transition-all duration-200 border ${
        disabled ? 'opacity-50 cursor-not-allowed' :
        isSelected
          ? 'bg-primary/30 border-primary border-2 shadow-glow ring-2 ring-primary/30'
          : 'bg-vote-inactive border-transparent hover:bg-vote-inactive-hover cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
          {labels[type]}
        </span>
        {isSelected && <TrendingUp className="w-2.5 h-2.5 text-primary" />}
      </div>
      
      <span className="text-sm font-bold text-foreground">
        {votes.toLocaleString()}
      </span>
      
      <span className={`text-xs ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
        {percentage}%
      </span>
    </button>
  );
});

VoteButton.displayName = 'VoteButton';

/**
 * Compact GUESS IT Button for featured cards
 * Same state logic as full button
 */
const GuessItButtonCompact = memo(({ 
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
      size="sm"
      className={`
        relative min-w-[80px] h-[60px] rounded-lg font-bold text-xs
        transition-all duration-300 transform
        ${state.isSaved 
          ? 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary/30' 
          : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg hover:scale-105'
        }
        ${isDisabled && !state.isSaved ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
        ${isLoading ? 'cursor-wait' : ''}
      `}
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : state.showCheck ? (
          <Check className="w-4 h-4" />
        ) : state.showUpdate ? (
          <RefreshCw className="w-4 h-4" />
        ) : (
          <span className="text-sm font-bold">G</span>
        )}
        <span className="text-[10px] font-semibold">
          {state.text}
        </span>
      </div>
    </Button>
  );
});

GuessItButtonCompact.displayName = 'GuessItButtonCompact';

/**
 * Compact Refresh Button for featured cards
 * Clears the current selection
 */
const RefreshButtonCompact = memo(({ onClick, disabled, hasSelection }) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || !hasSelection}
      variant="outline"
      size="sm"
      className={`
        relative min-w-[55px] h-[60px] rounded-lg font-bold text-xs
        transition-all duration-300 transform
        border-2 border-muted-foreground/30 hover:border-destructive/50
        bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive
        ${!hasSelection ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
      `}
      data-testid="refresh-prediction-compact-btn"
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <RotateCcw className="w-4 h-4" />
        <span className="text-[10px] font-semibold">Refresh</span>
      </div>
    </Button>
  );
});

RefreshButtonCompact.displayName = 'RefreshButtonCompact';

/**
 * Compact Advance Button for featured cards
 * Placeholder for advanced prediction features
 */
const AdvanceButtonCompact = memo(({ onClick, disabled }) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="outline"
      size="sm"
      className={`
        relative min-w-[55px] h-[60px] rounded-lg font-bold text-xs
        transition-all duration-300 transform
        border-2 border-amber-500/30 hover:border-amber-500
        bg-gradient-to-br from-amber-500/5 to-orange-500/10 
        hover:from-amber-500/20 hover:to-orange-500/20
        text-amber-600 dark:text-amber-400
        hover:scale-105 hover:shadow-md hover:shadow-amber-500/20
      `}
      data-testid="advance-prediction-compact-btn"
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <Sparkles className="w-4 h-4" />
        <span className="text-[10px] font-semibold">Advance</span>
      </div>
    </Button>
  );
});

AdvanceButtonCompact.displayName = 'AdvanceButtonCompact';

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

const TeamDisplay = memo(({ team }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-xs">
        {team.flag || team.logo || '⚽'}
      </div>
      <span className="text-xs font-medium text-foreground truncate">{team.name}</span>
    </div>
  );
});

TeamDisplay.displayName = 'TeamDisplay';

const TopMatchCard = ({ 
  match, 
  currentSelection,
  savedPrediction,
  onSelectPrediction, 
  onGuessIt,
  onRefresh,
  onAdvance,
  isLoading 
}) => {
  // The displayed selection is current if set, otherwise fall back to saved
  const displayedSelection = currentSelection !== undefined ? currentSelection : savedPrediction;
  
  // Status indicators
  const isCurrentSaved = savedPrediction && savedPrediction === displayedSelection;
  const hasUnsavedChanges = savedPrediction && displayedSelection && savedPrediction !== displayedSelection;

  return (
    <div className="flex-1 bg-card rounded-xl p-4 border border-border hover:border-border-hover transition-all duration-300 animate-scale-in">
      {/* Meta */}
      <div className="text-xs text-muted-foreground mb-3">
        <span>{match.dateTime}</span>
        <span className="mx-1">|</span>
        <span className="truncate">{match.competition}</span>
      </div>

      {/* Content Row */}
      <div className="flex items-center justify-between gap-2">
        {/* Teams */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-shrink-0">
          <TeamDisplay team={match.homeTeam} />
          <TeamDisplay team={match.awayTeam} />
        </div>

        {/* Votes */}
        <div className="flex items-center gap-1">
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
        <div className="flex items-center gap-1">
          <GuessItButtonCompact
            currentSelection={displayedSelection}
            savedPrediction={savedPrediction}
            isLoading={isLoading}
            onClick={() => onGuessIt(match.id)}
          />
          <AdvanceButtonCompact
            onClick={() => onAdvance(match.id)}
            disabled={isLoading}
          />
          <RefreshButtonCompact
            onClick={() => onRefresh(match.id)}
            disabled={isLoading}
            hasSelection={!!displayedSelection}
          />
        </div>
      </div>

      {/* Footer Stats */}
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

export const TopMatchesCards = ({ 
  matches, 
  savedPredictions = {}, 
  onPredictionSaved 
}) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [currentSelections, setCurrentSelections] = useState({});
  const [loadingMatches, setLoadingMatches] = useState({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPrediction, setPendingPrediction] = useState(null);

  const featuredMatches = matches.filter(m => m.featured).slice(0, 2);

  const handleSelectPrediction = useCallback((matchId, prediction) => {
    setCurrentSelections(prev => {
      const current = prev[matchId];
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

  const getEffectiveSelection = useCallback((matchId) => {
    if (matchId in currentSelections) {
      return currentSelections[matchId];
    }
    return savedPredictions[matchId] || null;
  }, [currentSelections, savedPredictions]);

  const handleGuessIt = useCallback(async (matchId) => {
    const selection = getEffectiveSelection(matchId);
    
    if (!selection) {
      toast.error('Please select an option first', {
        description: 'Choose 1, X, or 2 before making your prediction.',
        duration: 3000,
      });
      return;
    }

    if (savedPredictions[matchId] === selection) {
      toast.info('Prediction already saved', {
        description: 'Your current selection is already saved.',
        duration: 2000,
      });
      return;
    }

    if (!isAuthenticated) {
      setPendingPrediction({ matchId, prediction: selection });
      setShowAuthModal(true);
      return;
    }

    setLoadingMatches(prev => ({ ...prev, [matchId]: true }));
    
    try {
      const result = await savePrediction(matchId, selection);
      
      setCurrentSelections(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      
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

  if (featuredMatches.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
