'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { sendCustomEvent } from './google-analytics';

const SCROLL_THRESHOLDS = [10, 25, 50, 75, 90] as const;

export function useWindowScrollDepth(): void {
  const pathname = usePathname();
  const firedThresholds = useRef<Set<number>>(new Set());
  const shouldTrackScroll = useRef(true);
  const rafId = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (!shouldTrackScroll.current) return;
    if (typeof window === 'undefined') return;

    const scrollPercentage =
      ((window.scrollY + window.innerHeight) /
        document.documentElement.scrollHeight) *
      100;

    // Fire events for all thresholds we've passed but haven't fired yet
    for (const threshold of SCROLL_THRESHOLDS) {
      if (
        scrollPercentage >= threshold &&
        !firedThresholds.current.has(threshold)
      ) {
        firedThresholds.current.add(threshold);
        sendCustomEvent(`scroll_${threshold}`, 'scroll', pathname || '/');
      }
    }
  }, [pathname]);

  const throttledHandleScroll = useCallback(() => {
    if (rafId.current !== null) return;

    rafId.current = requestAnimationFrame(() => {
      handleScroll();
      rafId.current = null;
    });
  }, [handleScroll]);

  useEffect(() => {
    shouldTrackScroll.current = false;

    const timeout = setTimeout(() => {
      firedThresholds.current = new Set();
      shouldTrackScroll.current = true;
      // Immediately check current scroll position to capture thresholds
      // that may have been passed during the delay
      handleScroll();
    }, 500);

    return () => clearTimeout(timeout);
  }, [pathname, handleScroll]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [throttledHandleScroll]);
}
