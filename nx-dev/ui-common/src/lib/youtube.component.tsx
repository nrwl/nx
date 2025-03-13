import { Schema } from '@markdoc/markdoc';
import { cx } from '@nx/nx-dev/ui-primitives';
import { VideoJsonLd } from 'next-seo';

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
      type: 'String',
      required: false,
    },
    description: {
      type: 'String',
      required: false,
    },
    uploadDate: {
      type: 'String',
      required: false,
    },
  },
};

function computeEmbedURL(youtubeURL: string) {
  let match;

  if (youtubeURL.indexOf('embed') > -1) {
    // we already have the embed URL, so just ignore
    return youtubeURL;
  }

  // Check for 'https://www.youtube.com/watch?v=' format
  match = youtubeURL.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return 'https://www.youtube.com/embed/' + match[1];
  }

  match = youtubeURL.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return 'https://www.youtube.com/embed/' + match[1];
  }

  // Check for 'https://youtu.be/' format
  match = youtubeURL.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return 'https://www.youtube.com/embed/' + match[1];
  }

  throw new Error(`Could not properly compute the embed URL for ${youtubeURL}`);
}

// Internal function to compute thumbnail URL
function computeThumbnailURL(youtubeURL: string): string | null {
  let match;

  match = youtubeURL.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }

  match = youtubeURL.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }

  match = youtubeURL.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }

  // If the URL doesn't match any format, return null
  return null;
}

export function YouTube(props: {
  title: string;
  caption?: string;
  src: string;
  width?: string;
  disableRoundedCorners?: boolean;
  description?: string;
  uploadDate?: string;
}): JSX.Element {
  const embedUrl = computeEmbedURL(props.src);
  const thumbnailUrl = computeThumbnailURL(props.src);
  const currentDate = new Date().toISOString();

  return (
    <div className="text-center">
      {thumbnailUrl && (
        <VideoJsonLd
          name={props.title}
          description={props.description || props.title}
          thumbnailUrls={[thumbnailUrl]}
          uploadDate={props.uploadDate || currentDate}
          embedUrl={embedUrl}
          contentUrl={props.src}
        />
      )}
      <iframe
        src={embedUrl}
        title={props.title}
        width={props.width || '100%'}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        loading="lazy"
        className={cx({
          'rounded-lg shadow-lg': !props.disableRoundedCorners,
        })}
      />
      {props.caption && (
        <p className="mx-auto pt-0 text-slate-500 md:w-1/2 dark:text-slate-400">
          {props.caption}
        </p>
      )}
    </div>
  );
}
