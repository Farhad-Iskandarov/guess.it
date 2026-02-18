import { TrendingUp, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VoteButton = ({ type, votes, percentage, isSelected, onClick, isWinning }) => {
  const labels = { home: '1', draw: 'X', away: '2' };
  const isActive = isSelected || isWinning;

  return (
    <button
      onClick={() => onClick(type)}
      className={`flex flex-col items-center justify-center min-w-[80px] px-3 py-2 rounded-lg transition-all duration-200 border ${
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

const TeamRow = ({ team, isHome }) => {
  return (
    <div className="flex items-center gap-2.5">
      {/* Team Flag/Logo */}
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-base">
        {team.flag || team.logo || '⚽'}
      </div>
      {/* Team Name */}
      <span className="text-base font-medium text-foreground">
        {team.name}
      </span>
    </div>
  );
};

export const MatchCard = ({ match, userVote, onVote }) => {
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

  return (
    <div className="bg-card rounded-xl p-5 border border-border hover:border-border-hover transition-all duration-300 animate-slide-in">
      {/* Match Meta */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <span>{match.dateTime}</span>
        <span className="text-border">|</span>
        <span>{match.sport}</span>
        <span className="text-border">|</span>
        <span className="truncate">{match.competition}</span>
      </div>

      {/* Match Content */}
      <div className="flex items-center justify-between gap-4">
        {/* Teams */}
        <div className="flex flex-col gap-2.5">
          <TeamRow team={match.homeTeam} isHome={true} />
          <TeamRow team={match.awayTeam} isHome={false} />
        </div>

        {/* Vote Buttons */}
        <div className="flex items-center gap-2">
          <VoteButton
            type="home"
            votes={match.votes.home.count}
            percentage={match.votes.home.percentage}
            isSelected={userVote === 'home'}
            isWinning={mostPicked === 'home'}
            onClick={handleVote}
          />
          <VoteButton
            type="draw"
            votes={match.votes.draw.count}
            percentage={match.votes.draw.percentage}
            isSelected={userVote === 'draw'}
            isWinning={mostPicked === 'draw'}
            onClick={handleVote}
          />
          <VoteButton
            type="away"
            votes={match.votes.away.count}
            percentage={match.votes.away.percentage}
            isSelected={userVote === 'away'}
            isWinning={mostPicked === 'away'}
            onClick={handleVote}
          />
        </div>

        {/* More Button */}
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground px-2"
        >
          <span className="hidden sm:inline">More</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Match Stats */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/50 text-sm">
        <span className="text-muted-foreground">
          Total votes: <span className="text-foreground font-medium">{match.totalVotes.toLocaleString()}</span>
        </span>
        <span className="text-muted-foreground">
          Most picked: <span className="text-primary font-medium">{match.mostPicked}</span>
        </span>
      </div>
    </div>
  );
};

export default MatchCard;
