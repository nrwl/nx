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
    showDescription: {
      type: 'Boolean',
      required: false,
      default: false,
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

export type VideoPlayerProps = {
  src: string;
  alt: string;
  link?: string;
  showDescription?: boolean;
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
};

export function VideoPlayer({
  src,
  alt,
  link,
  showDescription = false,
  showControls,
  autoPlay,
  loop,
}: VideoPlayerProps): JSX.Element {
  return (
    <div className="mb-4 overflow-x-auto">
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/60">
        <div
          className={
            showDescription && alt
              ? 'overflow-hidden rounded-t-lg'
              : 'overflow-hidden rounded-lg'
          }
        >
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
        {showDescription && alt && (
          <div className="py-2 text-center text-sm text-slate-600 dark:text-slate-400">
            {alt}
          </div>
        )}
      </div>
    </div>
  );
}
