import {
  createContext,
  forwardRef,
  ReactElement,
  ReactNode,
  Ref,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { motion, MotionConfig, useAnimation } from 'framer-motion';
import { cx } from '@nx/nx-dev-ui-primitives';

export interface CarouselHandle {
  /**
   * Navigate to a specific slide index
   * @param index The zero-based index of the target slide
   */
  goToSlide: (index: number) => void;

  /**
   * Move to the next slide
   */
  goToNext: () => void;

  /**
   * Move to the previous slide
   */
  goToPrevious: () => void;

  /**
   * Get the current slide index
   */
  getCurrentIndex: () => number;

  /**
   * Get the total number of slides
   */
  getTotalSlides: () => number;

  /**
   * Pause the autoplay if it's enabled
   */
  pauseAutoPlay: () => void;

  /**
   * Resume the autoplay if it's enabled
   */
  resumeAutoPlay: () => void;
}

interface CarouselContextValue {
  currentIndex: number;
  totalSlides: number;
  goToSlide: (index: number) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  pauseAutoPlay: () => void;
  resumeAutoPlay: () => void;
  registerSlide: (id: string) => void;
  unregisterSlide: (id: string) => void;
}

interface CarouselRootProps {
  children: ReactNode;
  className?: string;
  autoPlayInterval?: number;
  animationDuration?: number;
  onSlideChange?: (index: number) => void;
  enableKeyboardNavigation?: boolean;
  ref?: Ref<CarouselHandle>;
}

const SPRING_CONFIG = {
  type: 'spring' as const,
  damping: 30,
  stiffness: 300,
  mass: 0.2,
};

const CarouselContext = createContext<CarouselContextValue | null>(null);

export const useCarousel = (): CarouselContextValue => {
  const context = useContext(CarouselContext);
  if (!context) {
    throw new Error('Carousel components must be used within a CarouselRoot');
  }
  return context;
};

export const CarouselRoot = forwardRef<CarouselHandle, CarouselRootProps>(
  (
    {
      children,
      className = '',
      autoPlayInterval,
      animationDuration = 0.5,
      onSlideChange,
      enableKeyboardNavigation = true,
    },
    ref
  ): ReactElement => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [slideIds, setSlideIds] = useState<string[]>([]);

    const autoPlayTimeoutRef = useRef<NodeJS.Timeout>();
    const containerRef = useRef<HTMLDivElement>(null);

    const goToSlide = useCallback(
      (index: number) => {
        // Ensure the index is within bounds
        const safeIndex = Math.max(0, Math.min(index, slideIds.length - 1));
        setCurrentIndex(safeIndex);

        // Call the onSlideChange callback if provided
        onSlideChange?.(safeIndex);
      },
      [slideIds.length, onSlideChange]
    );
    const goToNext = useCallback(() => {
      goToSlide((currentIndex + 1) % slideIds.length);
    }, [currentIndex, slideIds.length, goToSlide]);
    const goToPrevious = useCallback(() => {
      goToSlide((currentIndex - 1 + slideIds.length) % slideIds.length);
    }, [currentIndex, slideIds.length, goToSlide]);

    // Implement keyboard navigation
    useEffect(() => {
      if (!enableKeyboardNavigation) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        // Ignore keyboard navigation when user is typing in an input
        if (
          event.target instanceof HTMLInputElement ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey ||
          event.metaKey
        ) {
          return;
        }

        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault();
            goToPrevious();
            break;
          case 'ArrowRight':
            event.preventDefault();
            goToNext();
            break;
          case 'Home':
            event.preventDefault();
            goToSlide(0);
            break;
          case 'End':
            event.preventDefault();
            goToSlide(slideIds.length - 1);
            break;
          default:
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
      enableKeyboardNavigation,
      goToNext,
      goToPrevious,
      goToSlide,
      slideIds.length,
    ]);

    // Autoplay functionality
    const pauseAutoPlay = useCallback(() => {
      if (autoPlayTimeoutRef.current) {
        clearInterval(autoPlayTimeoutRef.current);
      }
    }, []);
    const resumeAutoPlay = useCallback(() => {
      if (autoPlayInterval) {
        pauseAutoPlay();
        autoPlayTimeoutRef.current = setInterval(goToNext, autoPlayInterval);
      }
    }, [autoPlayInterval, goToNext, pauseAutoPlay]);

    // Set up and clean up autoplay
    useEffect(() => {
      if (autoPlayInterval) {
        resumeAutoPlay();
      }
      return pauseAutoPlay;
    }, [autoPlayInterval, resumeAutoPlay, pauseAutoPlay]);

    // Register and unregister slides
    const registerSlide = useCallback((id: string) => {
      setSlideIds((prev) => [...prev, id]);
    }, []);
    const unregisterSlide = useCallback((id: string) => {
      setSlideIds((prev) => prev.filter((slideId) => slideId !== id));
    }, []);

    const contextValue = {
      currentIndex,
      totalSlides: slideIds.length,
      goToSlide,
      goToNext,
      goToPrevious,
      pauseAutoPlay,
      resumeAutoPlay,
      registerSlide,
      unregisterSlide,
    };

    // Expose methods through the ref
    useImperativeHandle(
      ref,
      () => ({
        goToSlide,
        goToNext,
        goToPrevious,
        getCurrentIndex: () => currentIndex,
        getTotalSlides: () => slideIds.length,
        pauseAutoPlay,
        resumeAutoPlay,
      }),
      [
        goToSlide,
        goToNext,
        goToPrevious,
        currentIndex,
        slideIds.length,
        pauseAutoPlay,
        resumeAutoPlay,
      ]
    );

    return (
      <CarouselContext.Provider value={contextValue}>
        <MotionConfig transition={{ duration: animationDuration }}>
          <div
            ref={containerRef}
            role="region"
            aria-roledescription="carousel"
            aria-label={`Carousel with ${slideIds.length} slides`}
            tabIndex={enableKeyboardNavigation ? 0 : undefined}
            className={cx('relative overflow-hidden', className)}
          >
            {children}
          </div>
        </MotionConfig>
      </CarouselContext.Provider>
    );
  }
);

export function CarouselViewport({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}): ReactElement {
  const { currentIndex } = useCarousel();
  const controls = useAnimation();

  useEffect(() => {
    controls.start({
      x: -currentIndex * 100 + '%',
      transition: SPRING_CONFIG,
    });
  }, [currentIndex, controls]);

  return (
    <motion.div animate={controls} className={cx('flex h-full', className)}>
      {children}
    </motion.div>
  );
}

export function CarouselSlide({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  const { registerSlide, unregisterSlide } = useCarousel();
  const slideId = useRef(`slide-${Math.random()}`);

  useEffect(() => {
    registerSlide(slideId.current);
    return () => unregisterSlide(slideId.current);
  }, [registerSlide, unregisterSlide]);

  return (
    <div
      role="group"
      aria-roledescription="slide"
      className={cx('w-full flex-shrink-0', className)}
    >
      {children}
    </div>
  );
}
