'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet: (
          id: string,
          el: HTMLElement,
          options?: Record<string, string>
        ) => Promise<HTMLElement | undefined>;
      };
    };
  }
}

function getTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

function loadTwitterScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.twttr?.widgets) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[src="https://platform.twitter.com/widgets.js"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

export function TweetEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tweetId = getTweetId(url);
    if (!tweetId || !containerRef.current) return;

    const container = containerRef.current;
    let cancelled = false;

    container.innerHTML = '';

    loadTwitterScript().then(() => {
      if (cancelled) return;
      window.twttr?.widgets.createTweet(tweetId, container, {
        conversation: 'none',
        theme: 'dark',
        dnt: 'true',
      });
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div ref={containerRef} className="not-prose">
      <a href={url}>Loading tweet...</a>
    </div>
  );
}
