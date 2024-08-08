'use client';

import { useState } from 'react';
import {
  AmazonMusicIcon,
  ApplePodcastsIcon,
  IHeartRadioIcon,
  SpotifyIcon,
} from '@nx/nx-dev/ui-icons';
import Link from 'next/link';

export function EpisodePlayer({
  podcastYoutubeId,
  podcastSpotifyId,
  amazonUrl,
  appleUrl,
  iHeartUrl,
}: {
  podcastYoutubeId: string;
  podcastSpotifyId: string;
  amazonUrl?: string;
  appleUrl?: string;
  iHeartUrl?: string;
}) {
  const [viewType, setViewType] = useState<ViewMode>('audio');
  return (
    <div className="flex basis-2/3 flex-col items-center justify-center gap-2">
      {viewType === 'audio' ? (
        <>
          <iframe
            style={{ borderRadius: '12px' }}
            src={`https://open.spotify.com/embed/episode/${podcastSpotifyId}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            key="audio"
          ></iframe>
          <div className="mb-4 mt-8">
            <PlatformLinks
              amazonUrl={amazonUrl}
              appleUrl={appleUrl}
              iHeartUrl={iHeartUrl}
              podcastSpotifyId={podcastSpotifyId}
            />
          </div>
        </>
      ) : (
        <iframe
          style={{ borderRadius: '12px' }}
          width="100%"
          height="400"
          src={`https://www.youtube.com/embed/${podcastYoutubeId}?si=8rkgAzJfLfd-hxAA`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          key="video"
        ></iframe>
      )}
      <div className="flex flex-wrap gap-6 sm:gap-4">
        <button
          className="space-x-4 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-2 text-lg font-medium text-slate-700 shadow-sm transition focus:ring-offset-2 group-hover:bg-slate-50 group-focus:ring-2 group-focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-slate-700 dark:group-focus:ring-sky-500"
          onClick={() => setViewType(getOpposite(viewType))}
        >
          Switch to {getOpposite(viewType) === 'audio' ? 'Audio' : 'Video'}
        </button>
        <Link
          className="space-x-4 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-2 text-lg font-medium text-slate-700 shadow-sm transition focus:ring-offset-2 group-hover:bg-slate-50 group-focus:ring-2 group-focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-slate-700 dark:group-focus:ring-sky-500"
          href="/podcast"
        >
          More Podcasts
        </Link>
      </div>
    </div>
  );
}

export function PlatformLinks({
  amazonUrl,
  appleUrl,
  iHeartUrl,
  podcastSpotifyId,
}: {
  amazonUrl?: string;
  appleUrl?: string;
  iHeartUrl?: string;
  podcastSpotifyId: string;
}): JSX.Element {
  const platforms = [
    {
      name: 'Amazon Music',
      url: amazonUrl,
      icon: AmazonMusicIcon,
    },
    {
      name: 'Apple Podcasts',
      url: appleUrl,
      icon: ApplePodcastsIcon,
    },
    {
      name: 'iHeartRadio',
      url: iHeartUrl,
      icon: IHeartRadioIcon,
    },
    {
      name: 'Spotify',
      url: `https://open.spotify.com/episode/${podcastSpotifyId}?si=Nqd7F40hQXugagH8oDxxpA`,
      icon: SpotifyIcon,
    },
  ];

  return (
    <ul className="flex flex-wrap gap-6 sm:gap-4">
      {platforms
        .filter((platform) => !!platform.url)
        .map((platform) => {
          return (
            <li
              key={platform.name}
              className="inline-block cursor-pointer place-items-center rounded-2xl border border-slate-100 bg-white p-4 text-slate-600 transition-all hover:scale-[1.02] hover:text-slate-950 dark:border-slate-800/60 dark:bg-slate-950  dark:text-slate-400 dark:hover:text-white"
            >
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full w-full items-center justify-center"
              >
                <platform.icon className="h-8 w-8 shrink-0" />
              </a>
            </li>
          );
        })}
    </ul>
  );
}

type ViewMode = 'audio' | 'video';

function getOpposite(viewMode: ViewMode): ViewMode {
  if (viewMode === 'audio') return 'video';
  return 'audio';
}
