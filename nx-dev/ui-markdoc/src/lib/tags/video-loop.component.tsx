'use client';
import { useEffect, useRef } from 'react';

export function VideoLoop({
  src,
  alt,
}: {
  src: string;
  alt: string;
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver;
    let videoElement = videoRef.current;

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
      <div className="p-4 text-center">
        <p className="pb-3 font-bold">
          Your browser does not support the video tag. Here is a description of
          the video:
        </p>
        <p>{alt}</p>
      </div>
    </video>
  );
}
