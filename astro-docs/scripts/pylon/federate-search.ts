/**
 * Post-build step: injects published Pylon KB articles into the Pagefind
 * index that Starlight already built, so site search surfaces them with
 * absolute Pylon URLs. Chained after `astro build` in project.json.
 *
 * This script must NEVER fail the build: if PYLON_API_TOKEN is missing or
 * the Pylon API is unreachable, injection is skipped with a warning and the
 * build ships without KB records in search (exit 0).
 *
 * Usage: tsx scripts/pylon/federate-search.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ASTRO_DOCS_ROOT,
  MAPPING_PATH,
  PYLON_DEFAULT_SEARCH_WEIGHT,
} from './config';
import { listArticles } from './pylon-api';

interface SearchRecord {
  id: string;
  title: string;
  slug: string;
  url: string;
  body_html: string;
}

const DIST_DIR = path.join(ASTRO_DOCS_ROOT, 'dist');
const PAGEFIND_DIR = path.join(DIST_DIR, 'pagefind');

async function fetchRecords(): Promise<SearchRecord[] | null> {
  if (process.env.NX_PYLON_OFFLINE === '1') {
    console.warn(
      '[pylon-search] NX_PYLON_OFFLINE=1 — building WITHOUT Pylon KB records in search'
    );
    return null;
  }
  if (!process.env.PYLON_API_TOKEN) {
    console.warn(
      '[pylon-search] PYLON_API_TOKEN not set — building WITHOUT Pylon KB records in search'
    );
    return null;
  }
  try {
    const articles = await listArticles();
    return articles
      .filter(
        (a) =>
          a.is_published &&
          (a.visibility_config?.visibility ?? 'public') === 'public'
      )
      .map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        url: a.url,
        body_html: a.current_published_content_html ?? '',
      }));
  } catch (error) {
    console.warn(
      `[pylon-search] Pylon API unavailable (${error instanceof Error ? error.message : error}) — building WITHOUT Pylon KB records in search`
    );
    return null;
  }
}

/**
 * Pagefind ranking weight for a federated record. Configure globally via
 * PYLON_DEFAULT_SEARCH_WEIGHT in config.ts, or per article via the `weight`
 * field in migration-list.json (persisted into pylon-kb.json).
 */
function weightFor(record: SearchRecord): number {
  try {
    const mapping = JSON.parse(
      fs.readFileSync(MAPPING_PATH, 'utf-8')
    ) as Record<string, { slug: string; weight?: number }>;
    for (const entry of Object.values(mapping)) {
      if (entry.slug === record.slug && entry.weight !== undefined) {
        return entry.weight;
      }
    }
  } catch {
    // mapping file optional
  }
  return PYLON_DEFAULT_SEARCH_WEIGHT;
}

function recordHtml(record: SearchRecord): string {
  let host = 'knowledge base';
  try {
    host = new URL(record.url).host;
  } catch {
    // keep fallback label
  }
  return (
    `<!doctype html><html lang="en"><head><title>${escapeHtml(record.title)}</title></head><body>` +
    `<main data-pagefind-body data-pagefind-weight="${weightFor(record)}" ` +
    `data-pagefind-filter="type:Knowledge Base" data-pagefind-meta="site:${escapeHtml(host)}">` +
    `<h1>${escapeHtml(record.title)}</h1>${record.body_html}</main></body></html>`
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function main(): Promise<void> {
  if (!fs.existsSync(path.join(PAGEFIND_DIR, 'pagefind-entry.json'))) {
    console.warn(
      `[pylon-search] No Pagefind bundle at ${PAGEFIND_DIR} — skipping injection`
    );
    return;
  }

  const records = await fetchRecords();
  if (!records || records.length === 0) {
    console.log(
      '[pylon-search] No Pylon articles to inject — leaving index as-is'
    );
    return;
  }

  // Dynamic import: pagefind is ESM-only and these scripts execute as CJS.
  const pagefind = await import('pagefind');
  const { index, errors: createErrors } = await pagefind.createIndex({});
  if (!index) {
    console.warn(
      `[pylon-search] createIndex failed: ${createErrors?.join('; ')} — skipping`
    );
    return;
  }

  const { errors: dirErrors, page_count } = await index.addDirectory({
    path: DIST_DIR,
  });
  if (dirErrors?.length) {
    console.warn(
      `[pylon-search] Re-indexing dist reported errors: ${dirErrors.join('; ')} — skipping to preserve existing index`
    );
    return;
  }

  let injected = 0;
  for (const record of records) {
    if (!record.url || !record.title) continue;
    const { errors } = await index.addHTMLFile({
      url: record.url,
      content: recordHtml(record),
    });
    if (errors?.length) {
      console.warn(
        `[pylon-search] Failed to add "${record.title}": ${errors.join('; ')}`
      );
    } else {
      injected++;
    }
  }

  const tmpOut = path.join(DIST_DIR, '.pagefind-tmp');
  fs.rmSync(tmpOut, { recursive: true, force: true });
  const { errors: writeErrors } = await index.writeFiles({
    outputPath: tmpOut,
  });
  if (writeErrors?.length) {
    console.warn(
      `[pylon-search] writeFiles failed: ${writeErrors.join('; ')} — existing index left untouched`
    );
    fs.rmSync(tmpOut, { recursive: true, force: true });
    return;
  }

  fs.rmSync(PAGEFIND_DIR, { recursive: true, force: true });
  fs.renameSync(tmpOut, PAGEFIND_DIR);
  console.log(
    `[pylon-search] Injected ${injected} Pylon KB records (site pages re-indexed: ${page_count})`
  );
}

main().catch((error) => {
  console.warn(
    `[pylon-search] Unexpected error: ${error instanceof Error ? error.message : error} — build continues`
  );
});
