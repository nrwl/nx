import type { JSX, ReactNode, UIEvent } from 'react';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';

interface ScrollViewProps {
  children?: ReactNode;
  resetScrollOnNavigation?: boolean;
}

// Takes in a percentage like 0.33 and rounds to the nearest 0, 25%, 50%, 75%, 90% bucket.
function getScrollDepth(pct: number): 0 | 25 | 50 | 75 | 90 {
  // Anything greater than 0.9 is just 90% and counts as reaching the bottom.
  if (pct >= 0.9) {
    return 90;
  }

  // Otherwise, divide into quarters (0, 25, 50, 75).
  if (pct < 0.25) return 0;
  if (pct < 0.5) return 25;
  if (pct < 0.75) return 50;
  return 75;
}

export function ScrollableContent(props: ScrollViewProps): JSX.Element {
  const wrapperElement = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const scrollDepth = useRef(0);
  const shouldTrackScroll = useRef(true);

  useEffect(() => {
    if (!props.resetScrollOnNavigation) {
      scrollDepth.current = 0;
      return;
    }

    shouldTrackScroll.current = false;
    setTimeout(() => {
      scrollDepth.current = 0;
      shouldTrackScroll.current = true;
    }, 1000);

    const handleRouteChange = (url: string) => {
      if (url.includes('#')) return;
      if (!wrapperElement.current) return;

      wrapperElement.current.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [props.resetScrollOnNavigation, router, wrapperElement]);

  const handleScroll = (evt: UIEvent<HTMLDivElement>) => {
    if (!shouldTrackScroll.current) return;
    const el = evt.currentTarget;
    const { scrollHeight, scrollTop, offsetHeight } = el;
    const depth = getScrollDepth((scrollTop + offsetHeight) / scrollHeight);
    // Only track changes that are greater than the previous scroll depth.
    // If a user already viewed 90% of the page we don't need to know they went back to 50%.
    if (depth > scrollDepth.current) {
      scrollDepth.current = depth;
      sendCustomEvent(`scroll_${depth}`, 'scroll', router.asPath);
    }
  };

  return (
    <div
      ref={wrapperElement}
      id="wrapper"
      data-testid="wrapper"
      className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
      onScroll={handleScroll}
    >
      {props.children}
    </div>
  );
}

export default ScrollableContent;
