import { RefObject, useEffect, useState } from 'react';

export function useHeadingsObserver(
  elementRef: RefObject<Element>,
  { threshold = 0, root = null, rootMargin = '0%' }: IntersectionObserverInit,
  cachekey: string | null = null
): string {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const handleObserver = (entries: IntersectionObserverEntry[]): void => {
      for (const entry of entries) {
        if (entry?.isIntersecting) setActiveId(entry.target.id);
      }
    };

    const node = elementRef?.current; // DOM Ref
    const hasIOSupport = !!window.IntersectionObserver;

    if (!hasIOSupport || !node) return;
    const observer = new IntersectionObserver(handleObserver, {
      threshold,
      root,
      rootMargin,
    });

    const elements: NodeListOf<Element> = node.querySelectorAll('h1, h2, h3');
    elements.forEach((e: Element) => {
      observer.observe(e);
    });

    return () => observer.disconnect();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    elementRef?.current,
    JSON.stringify(threshold),
    root,
    rootMargin,
    cachekey,
  ]);

  return activeId;
}
