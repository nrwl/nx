'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { sendCustomEvent } from './google-analytics';

function getScrollDepth(pct: number): 0 | 25 | 50 | 75 | 90 {
  if (pct >= 0.9) return 90;
  if (pct < 0.25) return 0;
  if (pct < 0.5) return 25;
  if (pct < 0.75) return 50;
  return 75;
}

export function useWindowScrollDepth(): void {
  const pathname = usePathname();
  const scrollDepth = useRef(0);
  const shouldTrackScroll = useRef(true);
  const rafId = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (!shouldTrackScroll.current) return;
    if (typeof window === 'undefined') return;

    const scrollPercentage =
      (window.scrollY + window.innerHeight) /
      document.documentElement.scrollHeight;
    const depth = getScrollDepth(scrollPercentage);

    if (depth > scrollDepth.current) {
      scrollDepth.current = depth;
      sendCustomEvent(`scroll_${depth}`, 'scroll', pathname || '/');
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
      scrollDepth.current = 0;
      shouldTrackScroll.current = true;
    }, 500);

    return () => clearTimeout(timeout);
  }, [pathname]);

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
