'use client';

import { useState, useEffect, ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MonorepoWorldIcon } from '@nx/nx-dev/ui-icons';
import { ButtonLink } from './button';
import { PlayIcon } from '@heroicons/react/24/outline';

export function LiveStreamNotifier(): ReactElement {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  useEffect(() => {
    const sliderState = localStorage.getItem('live-stream-notifier');
    if (sliderState === 'minimized') {
      setIsExpanded(false);
    }
  }, []);

  const toggleSlider = () => {
    setIsExpanded(!isExpanded);
    localStorage.setItem(
      'live-stream-notifier',
      isExpanded ? 'minimized' : 'expanded'
    );
  };

  return (
    <motion.div
      layout
      initial={{ y: '120%' }}
      animate={{ y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 1,
      }}
      className="fixed bottom-1 right-1 z-30 w-[412px] cursor-pointer overflow-hidden rounded-lg bg-slate-950 p-4 text-white shadow-lg"
      onClick={toggleSlider}
      style={{ originY: 1 }}
    >
      <motion.h3
        layout="position"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <MonorepoWorldIcon aria-hidden="true" className="size-8" />
        MonorepoWorld live stream has started!
      </motion.h3>
      <AnimatePresence initial={true}>
        {isExpanded && (
          <motion.div
            key="live-event"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              opacity: { duration: 0.4 },
              height: { duration: 0.3, ease: 'easeInOut' },
            }}
            className="space-y-4"
          >
            <p className="mb-2 text-sm">
              Join us live at Monorepo World! Watch the latest talks and
              discussions happening now on YouTube or jump into the conversation
              on Discord.
            </p>
            <div className="flex items-center gap-4">
              <a
                title="Watch track 1"
                href="https://youtube.com/live/DRwhhOEKgCM"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#DDFB24] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#B2CF04] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:text-black/70"
              >
                <PlayIcon aria-hidden="true" className="size-4" />
                <span>Track 1</span>
              </a>
              <a
                href="https://youtube.com/live/5on1MGdEFJw"
                target="_blank"
                title="Watch track 2"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#DDFB24] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#B2CF04] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:text-black/70"
              >
                <PlayIcon aria-hidden="true" className="size-4" />
                <span>Track 2</span>
              </a>
              <ButtonLink
                variant="secondary"
                size="small"
                href="https://youtube.com/live/5on1MGdEFJw"
                target="_blank"
                title="Join the discussion on Discord"
                rel="noopener noreferrer"
              >
                Discord channel
              </ButtonLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
