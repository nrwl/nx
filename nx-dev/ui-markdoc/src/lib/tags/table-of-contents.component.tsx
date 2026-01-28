'use client';

import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface TableOfContentsProps {
  maxDepth?: number;
}

export function TableOfContents({
  maxDepth = 3,
}: TableOfContentsProps): JSX.Element {
  const [headings, setHeadings] = useState<TocItem[]>([]);

  useEffect(() => {
    // Find the content area where markdown content is rendered
    const content = document.querySelector('[data-content-area]');
    if (!content) return;

    // Get all headings h1-h6 within the content
    const headingElements = content.querySelectorAll('h2, h3, h4, h5, h6');

    const items: TocItem[] = Array.from(headingElements)
      .map((heading) => {
        const level = parseInt(heading.tagName[1]);
        if (level > maxDepth) return null;

        return {
          id: heading.id,
          text: heading.textContent || '',
          level,
        };
      })
      .filter((item): item is TocItem => item !== null);

    setHeadings(items);
  }, [maxDepth]);

  if (headings.length === 0) {
    return <></>;
  }

  return (
    <nav className="toc not-prose mb-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Table of Contents
      </p>
      <ul className="space-y-2 text-sm">
        {headings.map((heading) => (
          <li
            key={heading.id}
            style={{ paddingLeft: `${(heading.level - 2) * 1}rem` }}
          >
            <a
              href={`#${heading.id}`}
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
