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
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl md:text-5xl">
            Nx Tips
          </h1>
          <p className="mt-3 text-xl text-slate-500 dark:text-slate-400 sm:mt-4">
            Bite-sized Nx wisdom to supercharge your dev game
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {tips.map((tip) => (
            <div 
              key={tip.id} 
              className="flex flex-col items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm transition-all duration-300 ease-in-out hover:shadow-md hover:-translate-y-1 cursor-pointer"
              onClick={() => handleTipClick(tip)}
            >
              <div className="w-full aspect-video mb-4 overflow-hidden rounded-lg">
                <img
                  src={tip.thumbnailUrl}
                  alt={tip.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 text-center">
                {tip.title}
              </h3>
            </div>
          ))}
        </div>
      </div>
      {selectedTip && (
        <VideoPopup
          videoId={selectedTip.id}
          onClose={handleClosePopup}
        />
      )}
    </main>
  );
}