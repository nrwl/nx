import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ASTRO_DOCS_ROOT = path.resolve(__dirname, '..', '..');

export const PYLON_API_BASE = 'https://api.usepylon.com';
export const KNOWLEDGE_BASE_ID = 'e35aaa8d-4b65-4024-98c0-8e508846a027';

// Articles are authored as "Nx", not as the person running the script.
// Currently Caleb's Pylon user id; swap for a dedicated "Nx" service user if
// one is created in the Pylon workspace.
export const NX_AUTHOR_USER_ID = '222d97b2-91b4-4c99-96ad-0772a3f13295';

export const NX_DEV_ORIGIN = 'https://nx.dev';
export const DOCS_BASE_PATH = '/docs';

// Pylon write endpoints allow ~10-20 requests/minute.
export const WRITE_THROTTLE_MS = 4000;

// Multiplier stamped on injected Pagefind records. Site pages default to 1.0,
// so KB articles rank slightly below core docs unless overridden per article.
export const PYLON_DEFAULT_SEARCH_WEIGHT = 0.8;

export const MIGRATION_LIST_PATH = path.join(__dirname, 'migration-list.json');
export const MAPPING_PATH = path.join(
  ASTRO_DOCS_ROOT,
  'src',
  'content',
  'pylon-kb.json'
);
export const SEARCH_CACHE_PATH = path.join(
  ASTRO_DOCS_ROOT,
  'src',
  'content',
  'pylon-kb-search-cache.json'
);
export const REDIRECTS_PATH = path.join(
  ASTRO_DOCS_ROOT,
  'public',
  '_redirects'
);

export const CONTENT_DOCS_ROOT = path.join(
  ASTRO_DOCS_ROOT,
  'src',
  'content',
  'docs'
);

export const CANDIDATE_DIRS = [
  path.join(CONTENT_DOCS_ROOT, 'troubleshooting'),
  path.join(CONTENT_DOCS_ROOT, 'guides', 'Tips-n-Tricks'),
];

/**
 * Route path (under /docs) for a .mdoc file, matching Starlight's slug rules:
 * directory names are lowercased (Tips-n-Tricks -> tips-n-tricks).
 */
export function docsPathForSource(sourcePath: string): string {
  const rel = path
    .relative(CONTENT_DOCS_ROOT, sourcePath)
    .replace(/\.mdoc$/, '')
    .split(path.sep)
    .map((segment) => segment.toLowerCase())
    .join('/');
  return `${DOCS_BASE_PATH}/${rel}`;
}
