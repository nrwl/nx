'use client';

import { useState, useEffect, ReactElement } from 'react';
import { motion } from 'framer-motion';
import { MonorepoWorldIcon } from '@nx/nx-dev/ui-icons';
import { XMarkIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

export function LiveStreamNotifier(): ReactElement {
  const [isVisible, setIsVisible] = useState<boolean>(true);

  useEffect(() => {
    const isClosedSession = sessionStorage.getItem(
      'live-stream-notifier-closed'
    );
    if (isClosedSession === 'true') {
      setIsVisible(false);
    }
  }, []);

  const closeNotifier = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    sessionStorage.setItem('live-stream-notifier-closed', 'true');
  };

  if (!isVisible) return null;

  return (
    <motion.div
      layout
      initial={{ y: '120%' }}
      animate={{ y: 0 }}
      exit={{ y: '120%' }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 1,
      }}
      className="fixed bottom-0 left-0 right-0 z-30 w-full overflow-hidden bg-slate-950 text-white shadow-lg md:bottom-4 md:left-auto md:right-4 md:w-[512px] md:rounded-lg"
      style={{ originY: 1 }}
    >
      <div className="relative p-4">
        <button
          onClick={closeNotifier}
          className="absolute right-2 top-2 rounded-full p-1 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <XMarkIcon className="size-5" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>
        <div>
          <motion.h3
            layout="position"
            className="flex items-center gap-2 pr-8 text-lg font-semibold"
          >
            <MonorepoWorldIcon
              aria-hidden="true"
              className="size-8 flex-shrink-0"
            />
            <span>Monorepo World just ended!</span>
          </motion.h3>
          <motion.div key="live-event" className="mt-4 space-y-4">
            <p className="mb-2 text-sm">
              In case you missed Monorepo World, it is now available for replay.
            </p>
            <div className="flex flex-wrap items-center gap-1 sm:gap-4">
              <a
                title="Track 1 replay"
                href="http://go.nx.dev/MWTrack1"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#DDFB24] px-2 py-2 text-sm font-semibold text-black transition hover:bg-[#B2CF04] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:text-black/70 md:px-4"
              >
                <VideoCameraIcon aria-hidden="true" className="size-5" />
                <span>Track 1 replay</span>
              </a>
              <a
                href="http://go.nx.dev/MWTrack2"
                target="_blank"
                title="Track 2 replay"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#DDFB24] px-2 py-2 text-sm font-semibold text-black transition hover:bg-[#B2CF04] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:text-black/70 md:px-4"
              >
                <VideoCameraIcon aria-hidden="true" className="size-5" />
                <span>Track 2 replay</span>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
