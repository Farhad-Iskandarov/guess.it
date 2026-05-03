import { useMemo, useRef, useEffect } from 'react';
import { Radio, Flame, LayoutGrid, Star, Brain } from 'lucide-react';

/**
 * Mobile-first match filters:
 *  - Top row: horizontal scrollable date selector ([LIVE] [TODAY] [TUE 05 MAY] ...)
 *  - Bottom row: category pills (Top Matches / All Matches / Favorites / My Predictions)
 * Both rows scroll horizontally on mobile and are sticky beneath the header.
 */
export const MatchFilters = ({
  selectedDate,
  onDateChange,
  selectedCategory,
  onCategoryChange,
  liveCount = 0,
  favoritesCount = 0,
  predictionsCount = 0,
  isAuthenticated = false,
}) => {
  // Generate dates: LIVE + today + next 6 days
  const dateOptions = useMemo(() => {
    const opts = [{ id: 'live', isLive: true }];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      opts.push({
        id: iso,
        label: i === 0 ? 'TODAY' : weekday,
        sub: `${day} ${month}`,
        isToday: i === 0,
      });
    }
    return opts;
  }, []);

  const categories = useMemo(
    () => [
      { id: 'top', label: 'Top Matches', icon: Flame, iconColor: 'text-orange-500' },
      { id: 'all', label: 'All Matches', icon: LayoutGrid, iconColor: 'text-primary' },
      ...(isAuthenticated
        ? [
            { id: 'favorites', label: 'Favorites', icon: Star, iconColor: 'text-amber-400', count: favoritesCount },
            { id: 'predictions', label: 'My Predictions', icon: Brain, iconColor: 'text-violet-400', count: predictionsCount },
          ]
        : []),
    ],
    [favoritesCount, predictionsCount, isAuthenticated]
  );

  // Auto-scroll active date into view on mount / change
  const dateRowRef = useRef(null);
  useEffect(() => {
    const row = dateRowRef.current;
    if (!row) return;
    const active = row.querySelector('[data-active="true"]');
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDate]);

  return (
    <div
      className="sticky top-[57px] sm:top-[65px] z-40 bg-background/95 backdrop-blur-md border-b border-border/40 -mx-3 sm:-mx-4 px-3 sm:px-4 lg:mx-0 lg:px-0 lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
      data-testid="match-filters"
    >
      {/* === Date selector row === */}
      <div
        ref={dateRowRef}
        className="flex items-stretch gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide py-2.5 snap-x"
        data-testid="date-filter-row"
      >
        {dateOptions.map((d) => {
          const active = selectedDate === d.id;
          if (d.isLive) {
            return (
              <button
                key={d.id}
                onClick={() => onDateChange(d.id)}
                data-active={active}
                data-testid="date-filter-live"
                className={`snap-start flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] sm:min-w-[78px] px-3 py-2 rounded-xl border transition-colors duration-150 ${
                  active
                    ? 'bg-red-500/15 border-red-500 text-red-400'
                    : 'bg-secondary/60 hover:bg-secondary border-red-500/30 text-foreground'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 mb-0.5 text-red-500 ${liveCount > 0 ? 'animate-pulse' : ''}`} />
                <span className="text-[11px] font-bold tracking-wider">LIVE</span>
                <span className={`text-[10px] mt-0.5 leading-none ${active ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {liveCount > 0 ? `${liveCount} now` : '—'}
                </span>
              </button>
            );
          }
          return (
            <button
              key={d.id}
              onClick={() => onDateChange(d.id)}
              data-active={active}
              data-testid={`date-filter-${d.isToday ? 'today' : d.id}`}
              className={`snap-start flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] sm:min-w-[78px] px-3 py-2 rounded-xl border transition-colors duration-150 ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/60 hover:bg-secondary text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <span className="text-xs font-bold tracking-wide">{d.label}</span>
              <span className={`text-[10px] mt-0.5 leading-none ${active ? 'text-primary-foreground/85' : 'text-muted-foreground/70'}`}>
                {d.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* === Category pills row === */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-2.5" data-testid="category-filter-row">
        {categories.map((c) => {
          const active = selectedCategory === c.id;
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              data-active={active}
              data-testid={`category-filter-${c.id}`}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors duration-150 border ${
                active
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-secondary/60 hover:bg-secondary text-foreground border-border/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? '' : c.iconColor}`} />
              <span>{c.label}</span>
              {c.count > 0 && (
                <span
                  className={`min-w-[18px] text-center text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    active ? 'bg-background/20 text-background' : 'bg-muted text-foreground/80'
                  }`}
                >
                  {c.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MatchFilters;
