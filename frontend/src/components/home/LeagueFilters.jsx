import { Check, ChevronDown } from 'lucide-react';

export const LeagueFilters = ({ leagues, activeLeague, onLeagueChange }) => {
  return (
    <div className="flex items-center gap-2 sm:gap-3 py-3 sm:py-4 overflow-x-auto scrollbar-hide pr-4">
      {leagues.map((league) => {
        const isActive = activeLeague === league.id;
        const isSpecial = league.id === 'azerbaijan-league';
        
        return (
          <button
            key={league.id}
            onClick={() => onLeagueChange(league.id)}
            className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-glow'
                : isSpecial
                ? 'bg-transparent text-primary border border-primary/30 hover:border-primary/50'
                : 'bg-chip-inactive text-muted-foreground hover:bg-vote-inactive-hover hover:text-foreground'
            }`}
          >
            <span>{league.name}</span>
            {(league.id === 'ucl' || isSpecial) && (
              <span className="flex items-center">
                {isActive ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default LeagueFilters;
