import { useState, useRef, useEffect } from 'react';
import { TrendingUp, ChevronDown, Target, Users, Lightbulb, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const VoteButton = ({ type, votes, percentage, isSelected, onClick, isWinning, disabled }) => {
  const labels = { home: '1', draw: 'X', away: '2' };
  const isActive = isSelected || isWinning;

  return (
    <button
      onClick={() => !disabled && onClick(type)}
      disabled={disabled}
      data-testid={`vote-btn-${type}`}
      className={`flex flex-col items-center justify-center min-w-[80px] px-3 py-2 rounded-lg transition-all duration-200 border ${
        disabled ? 'opacity-50 cursor-not-allowed' :
        isActive
          ? 'bg-vote-active-bg border-primary text-foreground shadow-glow'
          : 'bg-vote-inactive border-transparent hover:bg-vote-inactive-hover hover:border-border'
      }`}
    >
      {/* Label Row */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-lg font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>
          {labels[type]}
        </span>
        {isActive && (
          <span className="px-1 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded">
            <TrendingUp className="w-3 h-3 inline" />
          </span>
        )}
      </div>
      
      {/* Vote Count */}
      <span className={`text-lg font-bold ${isActive ? 'text-foreground' : 'text-foreground'}`}>
        {votes.toLocaleString()}
      </span>
      
      {/* Percentage */}
      <span className={`text-sm ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
        {percentage}%
      </span>
    </button>
  );
};

const TeamRow = ({ team, isHome, score }) => {
  return (
    <div className="flex items-center gap-2.5">
      {/* Team Flag/Logo */}
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-base overflow-hidden">
        {team.crest ? (
          <img src={team.crest} alt={team.name} className="w-5 h-5 object-contain" />
        ) : (
          team.flag || team.logo || '⚽'
        )}
      </div>
      {/* Team Name */}
      <span className="text-base font-medium text-foreground">
        {team.name}
      </span>
      {/* Score if available */}
      {score !== null && score !== undefined && (
        <span className="ml-auto text-lg font-bold text-foreground tabular-nums">
          {score}
        </span>
      )}
    </div>
  );
};

// Exact Score Input Component
const ExactScoreInput = ({ 
  homeScore, 
  awayScore, 
  onHomeScoreChange, 
  onAwayScoreChange, 
  onSubmit, 
  isSubmitting,
  hasExactScore,
  homeTeamName,
  awayTeamName
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Target className="w-4 h-4 text-amber-500" />
        <span className="font-medium">Predict Exact Score</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">
          +50 BONUS
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Home Score */}
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground mb-1 block truncate">{homeTeamName}</label>
          <Input
            type="number"
            min="0"
            max="20"
            value={homeScore}
            onChange={(e) => onHomeScoreChange(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
            className="h-10 text-center text-lg font-bold bg-secondary/50"
            data-testid="exact-score-home"
            disabled={hasExactScore}
          />
        </div>
        
        <span className="text-lg font-bold text-muted-foreground pt-4">-</span>
        
        {/* Away Score */}
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground mb-1 block truncate">{awayTeamName}</label>
          <Input
            type="number"
            min="0"
            max="20"
            value={awayScore}
            onChange={(e) => onAwayScoreChange(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
            className="h-10 text-center text-lg font-bold bg-secondary/50"
            data-testid="exact-score-away"
            disabled={hasExactScore}
          />
        </div>
      </div>
      
      {!hasExactScore ? (
        <Button 
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full gap-2"
          data-testid="submit-exact-score"
        >
          <Target className="w-4 h-4" />
          {isSubmitting ? 'Submitting...' : 'Lock Exact Score Prediction'}
        </Button>
      ) : (
        <div className="text-center py-2 text-sm text-emerald-500 font-medium">
          ✓ Exact score prediction locked
        </div>
      )}
      
      <p className="text-[10px] text-muted-foreground text-center">
        Predict the exact final score to earn 50 bonus points if correct!
      </p>
    </div>
  );
};

// Smart Advice Component (placeholder - will be expanded in P2)
const SmartAdvice = ({ matchId, onGetAdvice, advice, isLoading }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="w-4 h-4 text-sky-500" />
        <span className="font-medium">Smart Advice</span>
      </div>
      
      {advice ? (
        <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
          <p className="text-sm text-foreground">{advice}</p>
        </div>
      ) : (
        <Button 
          onClick={onGetAdvice}
          variant="outline"
          disabled={isLoading}
          className="w-full gap-2"
          data-testid="get-smart-advice"
        >
          <Lightbulb className="w-4 h-4" />
          {isLoading ? 'Getting advice...' : 'Get Smart Advice'}
        </Button>
      )}
      
      <p className="text-[10px] text-muted-foreground text-center">
        Get prediction advice from a top performer
      </p>
    </div>
  );
};

// Invite Friend Component - Functional
const InviteFriend = ({ matchId, match }) => {
  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sending, setSending] = useState(null);
  const [sentTo, setSentTo] = useState([]);
  const API_URL = process.env.REACT_APP_BACKEND_URL || '';

  const loadFriends = async () => {
    if (friends.length > 0) { setShowFriends(true); return; }
    setLoadingFriends(true);
    try {
      const res = await fetch(`${API_URL}/api/friends/list`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingFriends(false); setShowFriends(true); }
  };

  const handleInvite = async (friend) => {
    if (!match) return;
    setSending(friend.user_id);
    try {
      const matchCardData = {
        match_id: matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: match.competition || '',
        dateTime: match.dateTime || '',
        status: match.status || 'SCHEDULED',
        score: match.score || {}
      };
      const res = await fetch(`${API_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiver_id: friend.user_id,
          message: `I invited you to predict on ${match.homeTeam?.name || ''} vs ${match.awayTeam?.name || ''}! Make your guess!`,
          message_type: 'match_share',
          match_data: matchCardData
        })
      });
      if (res.ok) {
        setSentTo(prev => [...prev, friend.user_id]);
      }
    } catch (err) { console.error(err); }
    finally { setSending(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserPlus className="w-4 h-4 text-emerald-500" />
        <span className="font-medium">Invite Friend</span>
      </div>
      
      {!showFriends ? (
        <Button 
          variant="outline"
          className="w-full gap-2"
          data-testid="invite-friend-btn"
          onClick={loadFriends}
          disabled={loadingFriends}
        >
          <UserPlus className="w-4 h-4" />
          {loadingFriends ? 'Loading friends...' : 'Select Friend to Invite'}
        </Button>
      ) : friends.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No friends yet. Add friends first!
        </p>
      ) : (
        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {friends.map(f => {
            const isSent = sentTo.includes(f.user_id);
            const pic = f.picture?.startsWith('/') ? `${API_URL}${f.picture}` : f.picture;
            return (
              <div key={f.user_id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary/30 transition-colors">
                <div className="w-7 h-7 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                  {pic ? <img src={pic} alt="" className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {(f.nickname || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-xs text-foreground font-medium truncate flex-1">{f.nickname}</span>
                <button
                  onClick={() => !isSent && handleInvite(f)}
                  disabled={sending === f.user_id || isSent}
                  data-testid={`invite-friend-${f.user_id}`}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    isSent ? 'bg-emerald-500/20 text-emerald-400' :
                    sending === f.user_id ? 'bg-secondary text-muted-foreground' :
                    'bg-primary/15 text-primary hover:bg-primary/25'
                  }`}
                >
                  {isSent ? 'Sent!' : sending === f.user_id ? '...' : 'Invite'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      
      <p className="text-[10px] text-muted-foreground text-center">
        Send match card to friends via chat
      </p>
    </div>
  );
};

// Friends Activity Component (placeholder - will be expanded in P2)
const FriendsActivity = ({ friends = [] }) => {
  if (friends.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4 text-purple-500" />
          <span className="font-medium">Friends Activity</span>
        </div>
        <p className="text-xs text-muted-foreground text-center py-2">
          No friends have predicted on this match yet
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="w-4 h-4 text-purple-500" />
        <span className="font-medium">Friends Activity</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-500 font-bold">
          {friends.length}
        </span>
      </div>
      
      <div className="flex items-center gap-1">
        {friends.slice(0, 5).map((friend, idx) => (
          <div 
            key={friend.user_id || idx}
            className="w-8 h-8 rounded-full bg-secondary border-2 border-card -ml-2 first:ml-0 overflow-hidden"
            title={friend.nickname}
          >
            {friend.picture ? (
              <img src={friend.picture} alt={friend.nickname} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {(friend.nickname || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {friends.length > 5 && (
          <span className="text-xs text-muted-foreground ml-2">
            +{friends.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
};

export const MatchCard = ({ 
  match, 
  userVote, 
  onVote, 
  onExactScoreSubmit,
  exactScorePrediction,
  friendsOnMatch = [],
  isAuthenticated = false
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [homeScoreInput, setHomeScoreInput] = useState(0);
  const [awayScoreInput, setAwayScoreInput] = useState(0);
  const [isSubmittingExact, setIsSubmittingExact] = useState(false);
  const [smartAdvice, setSmartAdvice] = useState(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const advancedRef = useRef(null);
  const [advancedHeight, setAdvancedHeight] = useState(0);
  
  // Measure advanced section height for smooth animation
  useEffect(() => {
    if (advancedRef.current) {
      setAdvancedHeight(advancedRef.current.scrollHeight);
    }
  }, [isAdvancedOpen, smartAdvice]);

  const handleVote = (voteType) => {
    onVote(match.id, voteType);
  };

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
  
  // Check if match is finished or in progress (can't predict)
  const isMatchLocked = match.status === 'FINISHED' || match.status === 'LIVE' || match.status === 'IN_PLAY';
  
  // Handle exact score submission
  const handleExactScoreSubmit = async () => {
    if (!onExactScoreSubmit) return;
    
    setIsSubmittingExact(true);
    try {
      await onExactScoreSubmit(match.id, homeScoreInput, awayScoreInput);
    } finally {
      setIsSubmittingExact(false);
    }
  };
  
  // Handle getting smart advice (placeholder for P2)
  const handleGetAdvice = async () => {
    setIsLoadingAdvice(true);
    // This will be implemented in P2
    setTimeout(() => {
      setSmartAdvice("Smart advice feature coming soon!");
      setIsLoadingAdvice(false);
    }, 1000);
  };

  // Initialize exact score from existing prediction
  useEffect(() => {
    if (exactScorePrediction) {
      setHomeScoreInput(exactScorePrediction.home_score || 0);
      setAwayScoreInput(exactScorePrediction.away_score || 0);
    }
  }, [exactScorePrediction]);

  return (
    <div 
      className="bg-card rounded-xl border border-border hover:border-border-hover transition-all duration-300 animate-slide-in overflow-hidden"
      data-testid={`match-card-${match.id}`}
    >
      <div className="p-5">
        {/* Match Meta */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <span>{match.dateTime}</span>
          <span className="text-border">|</span>
          <span>{match.sport || 'Football'}</span>
          <span className="text-border">|</span>
          <span className="truncate">{match.competition}</span>
          {match.status && match.status !== 'SCHEDULED' && match.status !== 'TIMED' && (
            <>
              <span className="text-border">|</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                match.status === 'LIVE' || match.status === 'IN_PLAY' 
                  ? 'bg-red-500/20 text-red-400 animate-pulse' 
                  : match.status === 'FINISHED' 
                    ? 'bg-zinc-500/20 text-zinc-400' 
                    : 'bg-amber-500/20 text-amber-400'
              }`}>
                {match.status === 'IN_PLAY' ? 'LIVE' : match.status}
              </span>
            </>
          )}
        </div>

        {/* Match Content */}
        <div className="flex items-center justify-between gap-4">
          {/* Teams */}
          <div className="flex flex-col gap-2.5 min-w-0 flex-1">
            <TeamRow 
              team={match.homeTeam} 
              isHome={true} 
              score={match.score?.home}
            />
            <TeamRow 
              team={match.awayTeam} 
              isHome={false} 
              score={match.score?.away}
            />
          </div>

          {/* Vote Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <VoteButton
              type="home"
              votes={match.votes.home.count}
              percentage={match.votes.home.percentage}
              isSelected={userVote === 'home'}
              isWinning={mostPicked === 'home'}
              onClick={handleVote}
              disabled={isMatchLocked}
            />
            <VoteButton
              type="draw"
              votes={match.votes.draw.count}
              percentage={match.votes.draw.percentage}
              isSelected={userVote === 'draw'}
              isWinning={mostPicked === 'draw'}
              onClick={handleVote}
              disabled={isMatchLocked}
            />
            <VoteButton
              type="away"
              votes={match.votes.away.count}
              percentage={match.votes.away.percentage}
              isSelected={userVote === 'away'}
              isWinning={mostPicked === 'away'}
              onClick={handleVote}
              disabled={isMatchLocked}
            />
          </div>
        </div>

        {/* Match Stats + Advanced Toggle */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50 text-sm">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              Total votes: <span className="text-foreground font-medium">{match.totalVotes.toLocaleString()}</span>
            </span>
            <span className="text-muted-foreground">
              Most picked: <span className="text-primary font-medium">{match.mostPicked}</span>
            </span>
          </div>
          
          {/* Advanced Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="text-muted-foreground hover:text-foreground gap-1.5"
            data-testid="advanced-toggle"
          >
            <span className="text-xs">Advanced</span>
            <ChevronDown 
              className={`w-4 h-4 transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`} 
            />
          </Button>
        </div>
      </div>
      
      {/* Advanced Section - Animated */}
      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ 
          maxHeight: isAdvancedOpen ? `${advancedHeight}px` : '0px',
          opacity: isAdvancedOpen ? 1 : 0
        }}
      >
        <div ref={advancedRef} className="px-5 pb-5">
          <div className="pt-3 border-t border-border/30">
            {!isAuthenticated ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  Please log in to access advanced features
                </p>
              </div>
            ) : isMatchLocked ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  Advanced options are not available for {match.status === 'FINISHED' ? 'finished' : 'live'} matches
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Exact Score */}
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                  <ExactScoreInput
                    homeScore={homeScoreInput}
                    awayScore={awayScoreInput}
                    onHomeScoreChange={setHomeScoreInput}
                    onAwayScoreChange={setAwayScoreInput}
                    onSubmit={handleExactScoreSubmit}
                    isSubmitting={isSubmittingExact}
                    hasExactScore={!!exactScorePrediction}
                    homeTeamName={match.homeTeam.name}
                    awayTeamName={match.awayTeam.name}
                  />
                </div>
                
                {/* Smart Advice */}
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                  <SmartAdvice
                    matchId={match.id}
                    onGetAdvice={handleGetAdvice}
                    advice={smartAdvice}
                    isLoading={isLoadingAdvice}
                  />
                </div>
                
                {/* Invite Friend */}
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                  <InviteFriend matchId={match.id} match={match} />
                </div>
                
                {/* Friends Activity */}
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                  <FriendsActivity friends={friendsOnMatch} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchCard;
