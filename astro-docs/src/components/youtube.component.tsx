import { PlayCircleIcon, PlayIcon } from '@heroicons/react/24/solid';
import { cx } from './utils/cx';

// TODO(caleb): this came from typedoc ui markdown impl in nx-dev
type Schema = any;

export const youtube: Schema = {
  render: 'YouTube',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },
    title: {
      type: 'String',
      required: true,
    },
    width: {
      type: 'String',
      default: '100%',
    },
    caption: {
      // Added caption attribute here
      type: 'String',
      required: false, // Not required since it's optional
    },
  },
};

export function computeVideoID(youtubeURL: string): string | undefined {
  let match;

  // Check for 'https://www.youtube.com/embed/' format
  match = youtubeURL.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Check for 'https://www.youtube.com/watch?v=' format
  match = youtubeURL.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  match = youtubeURL.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Check for 'https://youtu.be/' format
  match = youtubeURL.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return undefined;
}

export function computeThumbnailURL(youtubeURL: string) {
  const videoID = computeVideoID(youtubeURL);
  if (!videoID) {
    throw new Error(
      `Could not properly compute the thumbnail URL for ${youtubeURL}`
    );
  }
  return `https://i.ytimg.com/vi_webp/${videoID}/maxresdefault.webp`;
}

export function computeWatchOnYoutubeURL(youtubeURL: string) {
  const videoID = computeVideoID(youtubeURL);
  if (!videoID) {
    throw new Error(
      `Could not properly compute the embed URL for ${youtubeURL}`
    );
  }
  return 'https://www.youtube.com/watch?v=' + videoID;
}

export function computeEmbedURL(youtubeURL: string) {
  const videoID = computeVideoID(youtubeURL);
  if (!videoID) {
    throw new Error(
      `Could not properly compute the embed URL for ${youtubeURL}`
    );
  }
  return 'https://www.youtube.com/embed/' + videoID;
}

const youtubeIcon = (
  <svg
    fill="currentColor"
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 transform"
  >
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14c-1.88-.5-9.38-.5-9.38-.5s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.87.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.54 15.57V8.43L15.82 12l-6.28 3.57z" />
  </svg>
);

export function YouTube(props: {
  title: string;
  caption?: string;
  src: string;
  width?: string;
  disableRoundedCorners?: boolean;
  imageOnly?: boolean;
}): JSX.Element {
  return (
    <div className="text-center">
      {' '}
      {/* Center alignment applied to the container */}
      {props.imageOnly ? (
        <a
          href={computeWatchOnYoutubeURL(props.src)}
          className="relative block !text-inherit"
        >
          {youtubeIcon}
          <img
            src={computeThumbnailURL(props.src)}
            alt={props.title}
            width={props.width || '100%'}
            className={cx(
              {
                'rounded-lg shadow-lg': !props.disableRoundedCorners,
              },
              'aspect-video border-2 border-slate-200 hover:border-slate-500 dark:border-slate-700/40 dark:hover:border-slate-700'
            )}
          />
        </a>
      ) : (
        <iframe
          src={computeEmbedURL(props.src)}
          title={props.title}
          width={props.width || '100%'}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          loading="lazy"
          credentialless="true"
          className={cx('aspect-video', {
            'rounded-lg shadow-lg': !props.disableRoundedCorners,
          })}
        />
      )}
      {props.caption && (
        <p className="mx-auto pt-0 text-slate-500 md:w-1/2 dark:text-slate-400">
          {props.caption}
        </p>
      )}
    </div>
  );
}
