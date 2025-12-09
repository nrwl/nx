'use client';

import {
  createContext,
  ReactElement,
  ReactNode,
  useContext,
  useState,
} from 'react';
import { cx } from '@nx/nx-dev-ui-primitives';
import { MovingBorder } from '@nx/nx-dev-ui-animations';
import { motion } from 'framer-motion';
import { PlayIcon } from '@heroicons/react/24/outline';
import { VideoModal } from '../video-modal';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';
import {
  VideoPlayerButtonProps,
  VideoPlayerContextValue,
  VideoPlayerModalProps,
  VideoPlayerProps,
  VideoPlayerProviderProps,
  VideoPlayerThumbnailProps,
  VideoPlayerVariant,
} from './video-player.types';

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

const useVideoPlayer = () => {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error('useVideoPlayer must be used within a VideoPlayer');
  }
  return context;
};

const VARIANT_STYLES: Record<
  VideoPlayerVariant,
  {
    gradient: string;
    textColor: string;
    backgroundColor: string;
    borderColor: string;
  }
> = {
  'blue-pink': {
    gradient:
      'bg-[radial-gradient(var(--blue-500)_40%,transparent_60%)] opacity-[0.8] dark:bg-[radial-gradient(var(--pink-500)_40%,transparent_60%)]',
    textColor: 'text-white',
    backgroundColor: 'bg-white/10',
    borderColor: 'border-slate-100',
  },
  'blue-white-spin': {
    gradient:
      'bg-[conic-gradient(from_90deg_at_50%_50%,#FFFFFF_0%,#3B82F6_50%,#FFFFFF_100%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,#FFFFFF_0%,#0EA5E9_50%,#FFFFFF_100%)]',
    textColor: 'text-slate-950',
    backgroundColor: 'bg-white/70',
    borderColor: 'border-slate-100',
  },
};

/**
 * Main VideoPlayer component that provides the relative positioning context for video player elements.
 *
 * @example
 * ```tsx
 * // Basic modal video player
 * <VideoPlayerProvider
 *   videoUrl="https://youtu.be/example123"
 *   analytics={{
 *     event: 'video-click',
 *     category: 'marketing',
 *     label: 'hero-video',
 *   }}
 * >
 *   <VideoPlayer>
 *     <VideoPlayerThumbnail
 *       src="/path/to/thumbnail.jpg"
 *       alt="Video thumbnail"
 *       width={960}
 *       height={540}
 *     />
 *     <VideoPlayerOverlay>
 *       <VideoPlayerButton
 *         variant="blue-pink"
 *         text={{
 *           primary: 'Watch the interview',
 *           secondary: 'Under 3 minutes.',
 *         }}
 *       />
 *     </VideoPlayerOverlay>
 *   </VideoPlayer>
 *   <VideoPlayerModal />
 * </VideoPlayerProvider>
 * ```
 *
 * @example
 * ```tsx
 * // Inline video player
 * <VideoPlayerProvider
 *   videoUrl="https://youtu.be/example123"
 *   analytics={{
 *     event: 'video-click',
 *     category: 'marketing',
 *     label: 'inline-video',
 *   }}
 * >
 *   <VideoPlayer>
 *     <VideoPlayerThumbnail
 *       src="/path/to/thumbnail.jpg"
 *       alt="Video thumbnail"
 *     />
 *     <VideoPlayerOverlay>
 *       <VideoPlayerInlineButton
 *         variant="blue-pink"
 *         text={{
 *           primary: 'Watch the video',
 *           secondary: 'See it in action.',
 *         }}
 *       />
 *     </VideoPlayerOverlay>
 *     <VideoPlayerInline autoplay />
 *   </VideoPlayer>
 * </VideoPlayerProvider>
 * ```
 *
 * @example
 * ```tsx
 * // Custom composition with additional elements
 * <VideoPlayerProvider
 *   videoUrl="https://youtu.be/example123"
 *   analytics={{
 *     event: 'custom-video-click',
 *     category: 'custom',
 *     label: 'custom-example',
 *   }}
 * >
 *   <div className="relative">
 *     <VideoPlayer>
 *       <VideoPlayerThumbnail
 *         src="/path/to/thumbnail.jpg"
 *         alt="Custom video thumbnail"
 *       />
 *       <VideoPlayerOverlay>
 *         <VideoPlayerButton
 *           variant="blue-pink"
 *           text={{
 *             primary: 'Watch the video',
 *             secondary: 'Learn more about Nx.',
 *           }}
 *         />
 *       </VideoPlayerOverlay>
 *     </VideoPlayer>
 *
 *     // Custom overlay content
 *     <div className="absolute bottom-4 left-4 text-white">
 *       <h3 className="text-lg font-semibold">Custom Video Title</h3>
 *       <p className="text-sm opacity-90">Additional context here</p>
 *     </div>
 *   </div>
 *
 *   <VideoPlayerModal />
 * </VideoPlayerProvider>
 * ```
 */
export function VideoPlayer({
  children,
  className,
}: VideoPlayerProps): ReactElement {
  return <div className={cx('relative', className)}>{children}</div>;
}

/**
 * VideoPlayerProvider provides context for video state and analytics.
 * Must wrap all other VideoPlayer components to provide shared state.
 *
 * @example
 * ```tsx
 * <VideoPlayerProvider
 *   videoUrl="https://youtu.be/example123"
 *   analytics={{
 *     event: 'video-click',
 *     category: 'marketing',
 *     label: 'hero-video',
 *   }}
 *   onPlay={() => console.log('Video started')}
 *   onClose={() => console.log('Video closed')}
 * >
 *   // VideoPlayer components
 * </VideoPlayerProvider>
 * ```
 *
 * @param videoUrl - YouTube video URL
 * @param analytics - Optional analytics configuration
 * @param onPlay - Optional callback when video starts playing
 * @param onClose - Optional callback when video modal closes
 * @param children - VideoPlayer components to render
 */
export function VideoPlayerProvider({
  videoUrl,
  analytics,
  onPlay,
  onClose,
  children,
}: VideoPlayerProviderProps): ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const openModal = () => {
    if (analytics) {
      sendCustomEvent(analytics.event, analytics.category, analytics.label);
    }
    onPlay?.();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    onClose?.();
  };

  const startPlaying = () => {
    if (analytics) {
      sendCustomEvent(analytics.event, analytics.category, analytics.label);
    }
    onPlay?.();
    setIsPlaying(true);
  };

  const stopPlaying = () => {
    setIsPlaying(false);
  };

  const sendAnalytics = analytics
    ? (event: string, category: string, label: string) => {
        sendCustomEvent(event, category, label);
      }
    : undefined;

  const contextValue: VideoPlayerContextValue = {
    videoUrl,
    isModalOpen,
    isPlaying,
    openModal,
    closeModal,
    startPlaying,
    stopPlaying,
    sendAnalytics,
  };

  return (
    <VideoPlayerContext.Provider value={contextValue}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

/**
 * VideoPlayerThumbnail displays the video thumbnail image.
 *
 * @example
 * ```tsx
 * <VideoPlayerThumbnail
 *   src="/path/to/thumbnail.jpg"
 *   alt="Video thumbnail"
 *   width={960}
 *   height={540}
 *   className="rounded-xl"
 * />
 * ```
 *
 * @param src - Thumbnail image source URL
 * @param alt - Alt text for accessibility
 * @param width - Image width (default: 960)
 * @param height - Image height (default: 540)
 * @param className - Additional CSS classes
 */
export function VideoPlayerThumbnail({
  src,
  alt,
  width = 960,
  height = 540,
  className,
}: VideoPlayerThumbnailProps): ReactElement {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      className={cx('relative rounded-xl', className)}
    />
  );
}

/**
 * VideoPlayerButton renders the play button for modal-based video playback.
 *
 * @example
 * ```tsx
 * <VideoPlayerButton
 *   variant="blue-pink"
 *   text={{
 *     primary: 'Watch the interview',
 *     secondary: 'Under 3 minutes.',
 *   }}
 *   onClick={() => console.log('Button clicked')}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // CI variant with spinning gradient
 * <VideoPlayerButton
 *   variant="blue-white-spin"
 *   text={{
 *     primary: 'See how Nx Cloud works',
 *     secondary: 'In under 9 minutes',
 *   }}
 * />
 * ```
 *
 * @param variant - Visual variant: 'blue-pink' or 'blue-white-spin'
 * @param text - Button text configuration
 * @param onClick - Optional click callback
 * @param className - Additional CSS classes
 */
export function VideoPlayerButton({
  variant = 'blue-pink',
  size = 'md',
  text,
  onClick,
  className,
  ...props
}: VideoPlayerButtonProps): ReactElement {
  const { openModal } = useVideoPlayer();
  const styles = VARIANT_STYLES[variant];

  const isSmall = size === 'sm';
  const parent = {
    initial: {
      width: isSmall ? 41 : 82,
      transition: {
        when: 'afterChildren',
      },
    },
    hover: {
      width: isSmall ? 148 : 296,
      transition: {
        duration: 0.125,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };

  const child = {
    initial: {
      opacity: 0,
      x: -6,
    },
    hover: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.015,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };

  const handleClick = () => {
    onClick?.();
    openModal();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-full bg-transparent p-[1px] shadow-md',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0">
        {variant === 'blue-white-spin' ? (
          <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#FFFFFF_0%,#3B82F6_50%,#FFFFFF_100%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,#FFFFFF_0%,#0EA5E9_50%,#FFFFFF_100%)]" />
        ) : (
          <MovingBorder duration={5000} rx="5%" ry="5%">
            <div
              className={cx(isSmall ? 'size-10' : 'size-20', styles.gradient)}
            />
          </MovingBorder>
        )}
      </div>
      <motion.div
        initial="initial"
        whileHover="hover"
        variants={parent}
        className={cx(
          'relative isolate flex cursor-pointer items-center justify-center rounded-full antialiased backdrop-blur-xl',
          isSmall ? 'size-10 gap-3 border p-3' : 'size-20 gap-6 border-2 p-6',
          styles.backgroundColor,
          styles.textColor,
          styles.borderColor
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${text.primary}. ${text.secondary}`}
      >
        <PlayIcon
          aria-hidden="true"
          className={cx(
            'absolute',
            isSmall ? 'left-3 top-3 size-4' : 'left-6 top-6 size-8'
          )}
        />
        <motion.div
          variants={child}
          className={cx(
            'absolute',
            isSmall ? 'left-10 top-3 w-48' : 'left-20 top-4 w-48'
          )}
        >
          <p className={cx('font-medium', isSmall ? 'text-xs' : 'text-base')}>
            {text.primary}
          </p>
          <p className={cx(isSmall ? 'sr-only' : 'text-xs')}>
            {text.secondary}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * VideoPlayerOverlay positions content over the thumbnail (typically contains the play button).
 *
 * @example
 * ```tsx
 * <VideoPlayerOverlay>
 *   <VideoPlayerButton
 *     variant="solutions"
 *     text={{
 *       primary: 'Watch the video',
 *       secondary: 'See it in action.',
 *     }}
 *   />
 * </VideoPlayerOverlay>
 * ```
 *
 * @example
 * ```tsx
 * // Custom overlay content
 * <VideoPlayerOverlay>
 *   <div className="flex flex-col items-center gap-4">
 *     <VideoPlayerButton {...buttonProps} />
 *     <p className="text-white text-sm">Click to play</p>
 *   </div>
 * </VideoPlayerOverlay>
 * ```
 *
 * @param children - Content to overlay on the thumbnail
 */
export function VideoPlayerOverlay({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="absolute inset-0 grid h-full w-full items-center justify-center">
      {children}
    </div>
  );
}

/**
 * VideoPlayerInline shows inline video when playing (for inline mode).
 * Only renders when video is playing, otherwise returns null.
 *
 * @example
 * ```tsx
 * <VideoPlayerInline autoplay />
 * ```
 *
 * @example
 * ```tsx
 * // Without autoplay
 * <VideoPlayerInline />
 * ```
 *
 * @param autoplay - Whether to autoplay the video (default: false)
 */
export function VideoPlayerInline({
  autoplay = false,
}: {
  autoplay?: boolean;
}): ReactElement {
  const { videoUrl, isPlaying } = useVideoPlayer();

  if (!isPlaying) return null;

  const embedUrl = videoUrl.replace('youtu.be/', 'youtube.com/embed/');

  return (
    <div className="absolute inset-0">
      <iframe
        src={`${embedUrl}${autoplay ? '?autoplay=1' : ''}`}
        title="Video player"
        width="100%"
        height="100%"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 size-full rounded-xl"
      />
    </div>
  );
}

/**
 * VideoPlayerModal shows video in a modal (for modal mode).
 *
 * @example
 * ```tsx
 * <VideoPlayerModal />
 * ```
 *
 * @example
 * ```tsx
 * // With custom close handler
 * <VideoPlayerModal onClose={() => console.log('Modal closed')} />
 * ```
 *
 * @param onClose - Optional callback when modal closes
 */
export function VideoPlayerModal({
  onClose = () => void 0,
}: VideoPlayerModalProps): ReactElement {
  const { videoUrl, isModalOpen, closeModal } = useVideoPlayer();

  const handleClose = () => {
    closeModal();
    onClose?.();
  };

  return (
    <VideoModal
      isOpen={isModalOpen}
      onClose={handleClose}
      videoUrl={videoUrl}
    />
  );
}

/**
 * VideoPlayerInlineButton renders the play button for inline video playback.
 *
 * @example
 * ```tsx
 * <VideoPlayerInlineButton
 *   variant="blue-pink"
 *   text={{
 *     primary: 'Watch the video',
 *     secondary: 'See it in action.',
 *   }}
 *   onClick={() => console.log('Button clicked')}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // CI variant for inline playback
 * <VideoPlayerInlineButton
 *   variant="blue-white-spin"
 *   text={{
 *     primary: 'See how it works',
 *     secondary: 'In under 5 minutes',
 *   }}
 * />
 * ```
 *
 * @param variant - Visual variant: 'blue-pink' or 'blue-white-spin'
 * @param text - Button text configuration
 * @param onClick - Optional click callback
 * @param className - Additional CSS classes
 */
export function VideoPlayerInlineButton({
  variant = 'blue-pink',
  size = 'md',
  text,
  onClick,
  className,
  ...props
}: VideoPlayerButtonProps): ReactElement {
  const { startPlaying } = useVideoPlayer();
  const styles = VARIANT_STYLES[variant];

  const isSmall = size === 'sm';
  const parent = {
    initial: {
      width: isSmall ? 41 : 82,
      transition: {
        when: 'afterChildren',
      },
    },
    hover: {
      width: isSmall ? 148 : 296,
      transition: {
        duration: 0.125,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };

  const child = {
    initial: {
      opacity: 0,
      x: -6,
    },
    hover: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.015,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };

  const handleClick = () => {
    onClick?.();
    startPlaying();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-full bg-transparent p-[1px] shadow-md',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0">
        {variant === 'blue-white-spin' ? (
          <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#FFFFFF_0%,#3B82F6_50%,#FFFFFF_100%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,#FFFFFF_0%,#0EA5E9_50%,#FFFFFF_100%)]" />
        ) : (
          <MovingBorder duration={5000} rx="5%" ry="5%">
            <div
              className={cx(isSmall ? 'size-10' : 'size-20', styles.gradient)}
            />
          </MovingBorder>
        )}
      </div>
      <motion.div
        initial="initial"
        whileHover="hover"
        variants={parent}
        className={cx(
          cx(
            'relative isolate flex cursor-pointer items-center justify-center rounded-full antialiased backdrop-blur-xl',
            isSmall ? 'size-10 gap-3 border p-3' : 'size-20 gap-6 border-2 p-6'
          ),
          styles.backgroundColor,
          styles.textColor,
          styles.borderColor
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${text.primary}. ${text.secondary}`}
      >
        <PlayIcon
          aria-hidden="true"
          className={cx(
            'absolute',
            isSmall ? 'left-3 top-3 size-4' : 'left-6 top-6 size-8'
          )}
        />
        <motion.div
          variants={child}
          className={cx(
            'absolute',
            isSmall ? 'left-10 top-2 w-24' : 'left-20 top-4 w-48'
          )}
        >
          <p className={cx('font-medium', isSmall ? 'text-sm' : 'text-base')}>
            {text.primary}
          </p>
          <p className={cx(isSmall ? 'text-[10px]' : 'text-xs')}>
            {text.secondary}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
