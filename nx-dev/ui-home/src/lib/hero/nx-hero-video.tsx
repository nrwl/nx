'use client';
import { ReactElement, useState } from 'react';
import { MovingBorder } from '@nx/nx-dev-ui-animations';
import Image from 'next/image';
import { PlayButton } from './play-button';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';

export function NxHeroVideo(): ReactElement {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="relative overflow-hidden pt-16">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="relative mb-6 mt-0 overflow-hidden rounded-xl bg-transparent p-[0.5px] text-xl shadow-lg">
          <div className="absolute inset-0">
            <MovingBorder duration={4500} rx="5%" ry="5%">
              <div className="h-20 w-20 bg-[radial-gradient(var(--blue-500)_40%,transparent_60%)] opacity-[0.8] dark:bg-[radial-gradient(var(--pink-500)_40%,transparent_60%)]" />
            </MovingBorder>
          </div>
          <div
            className="relative w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 antialiased backdrop-blur-xl dark:border-slate-900 dark:bg-slate-900/[0.8]"
            style={{ aspectRatio: '16/9' }}
          >
            {isPlaying ? (
              <iframe
                src="https://www.youtube.com/embed/pbAQErStl9o?autoplay=1"
                title="Nx Developer Experience Video"
                width="100%"
                height="100%"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 size-full rounded-xl"
              />
            ) : (
              <>
                <Image
                  src="/images/home/nx-dev-video-cover.avif"
                  alt="Editor with Nx features"
                  width={2550}
                  height={1622}
                  loading="eager"
                  priority
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 z-10 grid h-full w-full items-center justify-center">
                  <PlayButton
                    onClick={() => {
                      setIsPlaying(true);
                      sendCustomEvent(
                        'nx-hero-video-play-click',
                        'hero-video',
                        'home'
                      );
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
