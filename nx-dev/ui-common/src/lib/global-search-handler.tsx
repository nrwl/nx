'use client';

import { useEffect } from 'react';

const SEARCH_STORAGE_KEY = 'nx-open-search';
const SEARCH_EXPIRY_MS = 30000; // 30 seconds

/**
 * GlobalSearchHandler - Listens for Cmd+K / Ctrl+K keyboard shortcuts
 * and redirects to the docs page with the search modal open.
 *
 * This component should be included in the root layout of non-docs pages
 * to provide a consistent search experience across the entire site.
 *
 * Uses sessionStorage to signal Astro docs to open the search modal.
 */
export function GlobalSearchHandler(): null {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Store timestamp in sessionStorage for Astro docs to read
        sessionStorage.setItem(SEARCH_STORAGE_KEY, Date.now().toString());

        // Redirect to docs
        window.location.assign('/docs/getting-started/intro');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // This component doesn't render anything
  return null;
}
