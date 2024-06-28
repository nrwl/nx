'use client';

import { useState } from 'react';
import { PodcastData } from '../podcast-data';

export function EpisodePlayer({ data }: { data: PodcastData }) {
  const [viewType, setViewType] = useState<ViewMode>('audio');
  return (
    <div className="flex basis-2/3 flex-col items-center justify-center gap-2">
      {viewType === 'audio' ? (
        <iframe
          style={{ borderRadius: '12px' }}
          src="https://open.spotify.com/embed/episode/24yagCNpu9EGj0fCwSDQkj?utm_source=generator&theme=0"
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          key="audio"
        ></iframe>
      ) : (
        <iframe
          style={{ borderRadius: '12px' }}
          width="100%"
          height="400"
          src={`https://www.youtube.com/embed/${data.youtubeId}?si=8rkgAzJfLfd-hxAA`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          key="video"
        ></iframe>
      )}
      <button
        className="space-x-4 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-2 text-lg font-medium text-slate-700 shadow-sm transition focus:ring-offset-2 group-hover:bg-slate-50 group-focus:ring-2 group-focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-slate-700 dark:group-focus:ring-sky-500"
        onClick={() => setViewType(getOpposite(viewType))}
      >
        Switch to {getOpposite(viewType) === 'audio' ? 'Audio' : 'Video'}
      </button>
    </div>
  );
}

type ViewMode = 'audio' | 'video';

function getOpposite(viewMode: ViewMode): ViewMode {
  if (viewMode === 'audio') return 'video';
  return 'audio';
}
