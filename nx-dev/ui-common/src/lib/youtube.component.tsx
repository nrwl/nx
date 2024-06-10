import { Schema } from '@markdoc/markdoc';

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

export function computeEmbedURL(youtubeURL: string) {
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

  // Check for 'https://youtu.be/' format
  match = youtubeURL.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return 'https://www.youtube.com/embed/' + match[1];
  }

  throw new Error(`Could not properly compute the embed URL for ${youtubeURL}`);
}

export function YouTube(props: {
  title: string;
  caption: string;
  src: string;
  width: string;
}): JSX.Element {
  return (
    <div className="text-center">
      {' '}
      {/* Center alignment applied to the container */}
      <iframe
        src={computeEmbedURL(props.src)}
        title={props.title}
        width={props.width || '100%'}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        loading="lazy"
        className="mb-1 rounded-lg shadow-lg"
      />
      {props.caption && (
        <p className="mx-auto pt-0 text-slate-500 md:w-1/2 dark:text-slate-400">
          {props.caption}
        </p>
      )}
    </div>
  );
}
