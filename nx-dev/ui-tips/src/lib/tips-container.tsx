'use client';
import React, { useState } from 'react';
import { VideoPopup } from './video-popup';

export interface Tip {
  id: string;
  title: string;
  thumbnailUrl: string;
}

export interface TipsContainerProps {
  tips: Tip[];
}

export function TipsContainer({ tips }: TipsContainerProps) {
  const [selectedTip, setSelectedTip] = useState<Tip | null>(null);

  const handleTipClick = (tip: Tip) => {
    setSelectedTip(tip);
  };

  const handleClosePopup = () => {
    setSelectedTip(null);
  };

  return (
    <main id="main" role="main" className="w-full py-8">
      <div className="mx-auto w-full max-w-[1088px] px-8">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl dark:text-slate-100">
            Nx Tips
          </h1>
          <p className="mt-3 text-xl text-slate-500 sm:mt-4 dark:text-slate-400">
            Bite-sized Nx wisdom to supercharge your dev game
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="flex cursor-pointer flex-col items-center rounded-lg border border-slate-200 p-4 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md dark:border-slate-700"
              onClick={() => handleTipClick(tip)}
            >
              <div className="mb-4 aspect-video w-full overflow-hidden rounded-lg">
                <img
                  src={tip.thumbnailUrl}
                  alt={tip.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <h3 className="text-center text-sm font-medium text-slate-900 dark:text-slate-100">
                {tip.title}
              </h3>
            </div>
          ))}
        </div>
      </div>
      {selectedTip && (
        <VideoPopup videoId={selectedTip.id} onClose={handleClosePopup} />
      )}
    </main>
  );
}
