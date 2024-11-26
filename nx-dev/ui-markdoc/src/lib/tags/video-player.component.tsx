import { VideoLoop } from './video-loop.component';
import { Schema } from '@markdoc/markdoc';

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
  },
};

export function VideoPlayer({
  src,
  alt,
  link,
}: {
  src: string;
  alt: string;
  link: string;
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      {link ? (
        <a href={link} target="_blank" rel="noreferrer">
          <VideoLoop src={src} alt={alt}></VideoLoop>
        </a>
      ) : (
        <VideoLoop src={src} alt={alt}></VideoLoop>
      )}
    </div>
  );
}
