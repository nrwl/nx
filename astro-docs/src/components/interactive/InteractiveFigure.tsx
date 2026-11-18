import { Suspense, useEffect, useState } from 'react';
import { FIGURES } from './registry';

// The figures read the theme, measure their box and start playing when
// scrolled into view, so they only render in the browser. The server renders
// the empty box at the reserved height: it keeps the page from jumping, and
// Astro's client:visible needs an element to observe before it hydrates.
export function InteractiveFigure({
  name,
  height,
}: {
  name: string;
  height: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const Figure = FIGURES[name];
  return (
    <div style={{ minHeight: height }}>
      {mounted && Figure ? (
        <Suspense fallback={null}>
          <Figure />
        </Suspense>
      ) : null}
    </div>
  );
}
