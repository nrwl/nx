'use client';
import { useRef } from 'react';

export function ClientVideo({
  src,
  alt,
  showControls = false,
  autoPlay = true,
  loop: explicitLoop,
}: {
  src: string;
  alt: string;
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loop = explicitLoop ?? autoPlay;

  return (
    <video
      ref={videoRef}
      autoPlay={autoPlay}
      muted
      loop={loop}
      playsInline
      controls={showControls}
      className="m-0 p-0"
    >
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
