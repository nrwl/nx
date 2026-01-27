'use client';

import { MouseEvent, ReactElement, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MegaphoneIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export interface WebinarNotifierProps {
  id: string;
  title: string;
  description: string;
  primaryCtaUrl: string;
  primaryCtaText: string;
  secondaryCtaUrl?: string;
  secondaryCtaText?: string;
  activeUntil?: string; // e.g. new Date.toISOString() '2025-12-11T13:33:35.695Z'
}

export function WebinarNotifier({
  id,
  title,
  description,
  primaryCtaUrl,
  primaryCtaText,
  secondaryCtaUrl,
  secondaryCtaText,
  activeUntil,
}: WebinarNotifierProps): ReactElement | null {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  const storageKey = `banner-${id}-dismissed`;

  useEffect(() => {
    setIsMounted(true);
    const isDismissed = localStorage.getItem(storageKey);
    if (isDismissed === 'true') {
      setIsVisible(false);
    }
  }, [storageKey]);

  const closeNotifier = (e: MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  // Check if banner has expired
  if (activeUntil && new Date() > new Date(activeUntil)) return null;

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
      className="fixed bottom-0 left-0 right-0 z-30 w-full overflow-hidden bg-zinc-950 text-white shadow-lg md:bottom-4 md:left-auto md:right-4 md:w-[512px] md:rounded-lg"
      style={{ originY: 1 }}
    >
      <div className="relative p-4">
        <button
          onClick={closeNotifier}
          className="absolute right-2 top-2 flex h-9 w-9 cursor-pointer items-center justify-center !rounded-full bg-transparent p-1 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-white"
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
            <span>{title}</span>
          </motion.h3>
          <motion.div key="banner-content" className="mt-4 space-y-4">
            <p className="mb-2 text-sm">{description}</p>
            <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-4">
              {secondaryCtaUrl && secondaryCtaText && (
                <a
                  href={secondaryCtaUrl}
                  target="_blank"
                  title={secondaryCtaText}
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm font-semibold text-white no-underline transition hover:bg-zinc-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:px-4"
                >
                  <ArrowTopRightOnSquareIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                  <span>{secondaryCtaText}</span>
                </a>
              )}
              <a
                title={primaryCtaText}
                href={primaryCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-2 py-2 text-sm font-semibold text-white no-underline transition hover:bg-pink-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:text-black/70 md:px-4"
              >
                <ArrowTopRightOnSquareIcon
                  aria-hidden="true"
                  className="size-4"
                />
                <span>{primaryCtaText}</span>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
