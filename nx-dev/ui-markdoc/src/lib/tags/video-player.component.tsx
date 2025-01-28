import { Schema } from '@markdoc/markdoc';
import { ClientVideo } from './client-video.component';

export const videoPlayer: Schema = {
  render: 'VideoPlayer',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },
    alt: {
      type: 'String',
      required: false,
    },
    link: {
      type: 'String',
      required: false,
    },
    showControls: {
      type: 'Boolean',
      required: false,
      default: false,
    },
    autoPlay: {
      type: 'Boolean',
      required: false,
      default: false,
    },
    loop: {
      type: 'Boolean',
      required: false,
      default: false,
    },
  },
};

export function VideoPlayer({
  src,
  alt,
  link,
  showControls,
  autoPlay,
  loop,
}: {
  src: string;
  alt: string;
  link?: string;
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
}): JSX.Element {
  return (
    <div className="mb-4 overflow-x-auto">
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/60">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer">
            <ClientVideo
              src={src}
              alt={alt}
              showControls={showControls}
              autoPlay={autoPlay}
              loop={loop}
            />
          </a>
        ) : (
          <ClientVideo
            src={src}
            alt={alt}
            showControls={showControls}
            autoPlay={autoPlay}
            loop={loop}
          />
        )}
      </div>
    </div>
  );
}
