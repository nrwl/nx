'use client';

import { MouseEvent, ReactElement, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MegaphoneIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export function WebinarNotifier(): ReactElement | null {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const localStorageKey = 'webinar-october-27-2025--notifier-closed';

  useEffect(() => {
    setIsMounted(true);
    const isClosedSession = localStorage.getItem(localStorageKey);
    if (isClosedSession === 'true') {
      setIsVisible(false);
    }
  }, []);

  const closeNotifier = (e: MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    localStorage.setItem(localStorageKey, 'true');
  };

  if (!isMounted || !isVisible) return null;

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
            <MegaphoneIcon
              aria-hidden="true"
              className="size-8 flex-shrink-0"
            />
            <span>Unlock the Full 70% of Your CI Gains</span>
          </motion.h3>
          <motion.div key="live-event" className="mt-4 space-y-4">
            <p className="mb-2 text-sm">
              Join our Oct. 27th webinar to learn how modern CI should work—and
              how Nx Cloud makes it happen.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-4">
              <a
                title="Signup"
                href="https://bit.ly/48iV9DZ"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-2 py-2 text-sm font-semibold text-white transition hover:bg-pink-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:text-black/70 md:px-4"
              >
                <VideoCameraIcon aria-hidden="true" className="size-4" />
                <span>Sign Up Now</span>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
