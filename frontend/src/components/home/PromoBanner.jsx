import { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Memoized slide content to prevent unnecessary re-renders
const SlideContent = memo(({ slide }) => (
  <div className="max-w-md animate-fade-in">
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
    className="absolute top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all duration-200"
    style={{ [direction === 'prev' ? 'left' : 'right']: '1rem' }}
    aria-label={`${direction === 'prev' ? 'Previous' : 'Next'} slide`}
  >
    {direction === 'prev' ? (
      <ChevronLeft className="w-5 h-5" />
    ) : (
      <ChevronRight className="w-5 h-5" />
    )}
  </button>
));

NavButton.displayName = 'NavButton';

// Memoized dot indicator
const DotIndicator = memo(({ index, isActive, onClick }) => (
  <button
    onClick={() => onClick(index)}
    className={`w-2 h-2 rounded-full transition-all duration-300 ${
      isActive
        ? 'w-6 bg-[#facc15] dot-active'
        : 'bg-white/30 hover:bg-white/50'
    }`}
    aria-label={`Go to slide ${index + 1}`}
  />
));

DotIndicator.displayName = 'DotIndicator';

export const PromoBanner = ({ slides }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slides with useCallback for optimization
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
    // Resume auto-play after 10 seconds of inactivity
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

  const slide = slides[currentSlide];

  return (
    // Theme-independent banner container - uses fixed dark colors
    <div 
      className="relative w-full overflow-hidden rounded-xl"
      data-theme-independent="true"
    >
      {/* Banner Container - Fixed dark gradient that doesn't change with theme */}
      <div 
        className="relative h-[280px] md:h-[320px] lg:h-[360px] w-full bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(20, 20, 20, 0.95) 0%, rgba(20, 20, 20, 0.7) 50%, rgba(20, 20, 20, 0.3) 100%), url(${slide.image})`
        }}
      >
        {/* Content */}
        <div className="absolute inset-0 flex items-center">
          <div className="container mx-auto px-6 md:px-10">
            <SlideContent slide={slide} />
          </div>
        </div>

        {/* Navigation Arrows - Fixed dark styling */}
        <NavButton direction="prev" onClick={prevSlide} />
        <NavButton direction="next" onClick={nextSlide} />
      </div>

      {/* Carousel Dots - Fixed styling */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
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
