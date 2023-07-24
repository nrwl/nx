import { Schema } from '@markdoc/markdoc';
import { useEffect, useRef } from 'react';

export const videoLoop: Schema = {
  render: 'VideoLoop',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },
  },
};

export function VideoLoop({ src }: { src: string }): JSX.Element {
  const videoRef = useRef(null);

  useEffect(() => {
    let observer: IntersectionObserver;
    let videoElement = videoRef.current as HTMLVideoElement | null;

    if (videoElement) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (videoElement) {
              if (entry.isIntersecting) {
                videoElement.play();
              } else {
                videoElement.pause();
              }
            }
          });
        },
        {
          threshold: 0.5,
        }
      );

      observer.observe(videoElement);
    }
    return () => {
      if (observer && videoElement) {
        observer.unobserve(videoElement);
      }
    };
  }, []);

  return (
    <video ref={videoRef} autoPlay muted loop>
      <source src={src} type="video/mp4" />
    </video>
  );
}
