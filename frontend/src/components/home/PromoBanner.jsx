import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Memoized slide content to prevent unnecessary re-renders
const SlideContent = memo(({ slide }) => (
  <div className="max-w-md">
    {/* Badge */}
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/30 mb-4">
      <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
      <span className="text-sm font-medium text-[#22c55e]">{slide.badge}</span>
    </div>

    {/* Headline - Fixed colors that don't change with theme */}
    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 leading-tight">
      <span className="text-white">{slide.headline} </span>
      <span className="text-[#facc15]">{slide.highlightedText}</span>
    </h1>

    {/* Subtitle - Fixed color */}
    <p className="text-gray-300 text-base md:text-lg mb-6 leading-relaxed">
      {slide.subtitle}
    </p>

    {/* CTA Button - Fixed yellow color */}
    <Button 
      className="bg-[#facc15] hover:bg-[#fbbf24] text-[#1a1a1a] font-semibold px-8 py-3 h-auto rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
    >
      {slide.ctaText}
    </Button>
  </div>
));

SlideContent.displayName = 'SlideContent';

// Memoized navigation button
const NavButton = memo(({ direction, onClick }) => (
  <button
    onClick={onClick}
    className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 active:bg-black/70 text-white z-20"
    style={{
      [direction === 'prev' ? 'left' : 'right']: '0.5rem',
      transition: 'background-color 0.2s ease',
    }}
    aria-label={`${direction === 'prev' ? 'Previous' : 'Next'} slide`}
    data-testid={`banner-${direction}`}
  >
    {direction === 'prev' ? (
      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
    ) : (
      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
    )}
  </button>
));

NavButton.displayName = 'NavButton';

// Memoized dot indicator
const DotIndicator = memo(({ index, isActive, onClick }) => (
  <button
    onClick={() => onClick(index)}
    className={`h-2 rounded-full ${
      isActive
        ? 'w-6 bg-[#facc15] dot-active'
        : 'w-2 bg-white/30 hover:bg-white/50'
    }`}
    style={{ transition: 'width 0.3s ease, background-color 0.3s ease' }}
    aria-label={`Go to slide ${index + 1}`}
  />
));

DotIndicator.displayName = 'DotIndicator';

export const PromoBanner = ({ slides }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, slides.length]);

  const goToSlide = useCallback((index) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  }, [slides.length]);

  // Touch / Swipe / Mouse drag support for carousel
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartX.current;
    const deltaY = endY - touchStartY.current;
    // Trigger swipe if horizontal > 40px and larger than vertical
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [nextSlide, prevSlide]);

  const handleMouseDown = useCallback((e) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
  }, []);

  const handleMouseUp = useCallback((e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.clientX - touchStartX.current;
    const deltaY = e.clientY - touchStartY.current;
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [nextSlide, prevSlide]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl select-none"
      data-theme-independent="true"
      data-testid="promo-banner"
      style={{ cursor: 'grab', touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Fixed-height container for all slides */}
      <div className="promo-banner-slides" style={{ position: 'relative', width: '100%', height: '100%' }}>
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className="promo-banner-slide"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: index === currentSlide ? 1 : 0,
              transition: 'opacity 0.7s ease-in-out',
              pointerEvents: index === currentSlide ? 'auto' : 'none',
              zIndex: index === currentSlide ? 1 : 0,
            }}
          >
            {/* Background image - fixed size, object-fit cover */}
            <img
              src={slide.image}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
              draggable={false}
            />
            {/* Dark gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to right, rgba(20, 20, 20, 0.95) 0%, rgba(20, 20, 20, 0.7) 50%, rgba(20, 20, 20, 0.3) 100%)',
              }}
            />
            {/* Content */}
            <div className="absolute inset-0 flex items-center z-10">
              <div className="container mx-auto px-4 sm:px-8 md:pl-[4.5rem] md:pr-10">
                <SlideContent slide={slide} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <NavButton direction="prev" onClick={prevSlide} />
      <NavButton direction="next" onClick={nextSlide} />

      {/* Carousel Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {slides.map((_, index) => (
          <DotIndicator
            key={index}
            index={index}
            isActive={index === currentSlide}
            onClick={goToSlide}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(PromoBanner);
