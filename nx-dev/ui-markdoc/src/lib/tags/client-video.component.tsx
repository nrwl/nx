'use client';
import { useRef, useState } from 'react';

export function ClientVideo({
  src,
  alt,
  poster,
  showControls = false,
  autoPlay = true,
  loop: explicitLoop,
}: {
  src: string;
  alt: string;
  poster?: string;
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loop = explicitLoop ?? autoPlay;
  // Show the play overlay whenever the video is paused so users know it is playable.
  const [isPaused, setIsPaused] = useState(!autoPlay);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        muted
        loop={loop}
        playsInline
        controls={showControls}
        onPlay={() => setIsPaused(false)}
        onPause={() => setIsPaused(true)}
        className="m-0 block h-auto w-full p-0"
      >
        <source src={src} type="video/mp4" />
        <div className="p-4 text-center">
          <p className="pb-3 font-bold">
            Your browser does not support the video tag. Here is a description
            of the video:
          </p>
          <p>{alt}</p>
        </div>
      </video>
      {isPaused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            aria-label="Watch the video"
            onClick={() => videoRef.current?.play()}
            className="group pointer-events-auto relative inline-flex h-16 items-center overflow-hidden rounded-full border-2 border-zinc-100 shadow-md backdrop-blur-xl transition-all duration-150 ease-out"
          >
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#3b82f6_30%,transparent_70%)] opacity-80" />
            <span className="pointer-events-none absolute inset-0 bg-white/10" />
            <span className="relative z-10 flex items-center px-4 text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
                className="size-8 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.971l-11.54 6.348a1.125 1.125 0 0 1-1.667-.985V5.653Z"
                />
              </svg>
              <span className="max-w-0 overflow-hidden text-base font-medium whitespace-nowrap opacity-0 transition-all duration-150 ease-out group-hover:ml-2 group-hover:max-w-[12rem] group-hover:opacity-100">
                Watch the video
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
