import { useRef, useCallback, memo } from 'react';

/**
 * Horizontal scrollable image-card carousel for the banner section.
 * Each card is image-based with a minimal score/label overlay at the bottom.
 * - Swipe on mobile, drag or scroll on desktop
 * - Snap scrolling
 * - Partial next card visible to hint scrollability
 * - No auto-slide
 */

const HighlightCard = memo(({ card }) => (
  <div
    className="highlight-card flex-shrink-0 relative overflow-hidden rounded-2xl select-none"
    style={{
      width: 'clamp(155px, calc(40vw - 20px), 260px)',
      aspectRatio: '3/4',
      scrollSnapAlign: 'start',
    }}
    data-testid={`banner-card-${card.id}`}
  >
    {/* Full image background */}
    <img
      src={card.image}
      alt={card.label || ''}
      className="absolute inset-0 w-full h-full object-cover"
      loading="lazy"
      draggable={false}
    />

    {/* Bottom gradient overlay */}
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 35%, transparent 60%)',
      }}
    />

    {/* Bottom content overlay */}
    <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3.5 flex flex-col gap-1">
      {/* Score row with team crests */}
      {card.score && (
        <div className="flex items-center justify-center gap-1.5">
          {card.homeCrest && (
            <img src={card.homeCrest} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-contain bg-white/10 p-0.5" />
          )}
          <span className="text-white text-base sm:text-xl font-extrabold tracking-wider tabular-nums">
            {card.score}
          </span>
          {card.awayCrest && (
            <img src={card.awayCrest} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-contain bg-white/10 p-0.5" />
          )}
        </div>
      )}

      {/* Scorer names or short label */}
      {card.details && (
        <div className="flex flex-col items-center gap-0">
          {card.details.map((line, i) => (
            <span key={i} className="text-[9px] sm:text-[11px] text-gray-300 font-medium truncate max-w-full text-center leading-tight">
              {line}
            </span>
          ))}
        </div>
      )}

      {/* Fallback: just a label if no score */}
      {!card.score && card.label && (
        <span className="text-white text-xs sm:text-sm font-bold text-center">
          {card.label}
        </span>
      )}
    </div>

    {/* Optional top-right badge */}
    {card.badge && (
      <div className="absolute top-2 right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
        <span className="text-[8px] sm:text-[9px] text-yellow-400 font-bold">{card.badge}</span>
      </div>
    )}
  </div>
));
HighlightCard.displayName = 'HighlightCard';

export const PromoBanner = ({ slides }) => {
  const scrollRef = useRef(null);

  // Drag-to-scroll for desktop
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = useCallback((e) => {
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = 'grabbing';
    scrollRef.current.style.scrollSnapType = 'none';
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.2;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  }, []);

  const onMouseUpOrLeave = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    scrollRef.current.style.cursor = 'grab';
    scrollRef.current.style.scrollSnapType = 'x mandatory';
  }, []);

  return (
    <div className="relative w-full" data-testid="promo-banner">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 px-1"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: 'grab',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpOrLeave}
        onMouseLeave={onMouseUpOrLeave}
      >
        {slides.map((card) => (
          <HighlightCard key={card.id} card={card} />
        ))}
      </div>

      {/* Hide scrollbar */}
      <style>{`
        [data-testid="promo-banner"] div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default memo(PromoBanner);
