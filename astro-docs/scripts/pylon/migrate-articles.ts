/**
 * Migrates knowledge-base articles from astro-docs to the Pylon KB.
 * Idempotent: driven by migration-list.json, tracked in src/content/pylon-kb.json.
 * Unchanged articles are skipped, changed ones PATCHed, new ones POSTed.
 *
 * Usage:
 *   tsx scripts/pylon/migrate-articles.ts --dry-run [--out <dir>]
 *   PYLON_API_TOKEN=... tsx scripts/pylon/migrate-articles.ts [--no-publish] [--only <substr>]
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ASTRO_DOCS_ROOT,
  MAPPING_PATH,
  MIGRATION_LIST_PATH,
  NETLIFY_TOML_PATH,
  NX_AUTHOR_USER_ID,
  WRITE_THROTTLE_MS,
} from './config';
import {
  convertArticle,
  IMAGE_PLACEHOLDER_PREFIX,
  type ConvertedArticle,
} from './markdoc-to-html';
import {
  createArticle,
  listArticles,
  sleep,
  updateArticle,
  uploadFile,
  type PylonArticle,
} from './pylon-api';

interface MigrationEntry {
  sourcePath: string;
  collectionId: string;
  publish: boolean;
  weight?: number;
  /** Overrides the default slug (source file basename) — needed when two
   * articles share a basename, e.g. angular/react module-federation-with-ssr. */
  slug?: string;
}

interface MigrationList {
  articles: MigrationEntry[];
  extraRedirects?: Array<{ from: string; to: string }>;
}

interface MappingEntry {
  pylonId: string;
  slug: string;
  url: string;
  title: string;
  description: string;
  docsPath: string;
  contentHash: string;
  published: boolean;
  lastSyncedAt: string;
  weight?: number;
}

type Mapping = Record<string, MappingEntry>;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noPublish = args.includes('--no-publish');
const onlyFilter = args.includes('--only')
  ? args[args.indexOf('--only') + 1]
  : undefined;
const outDir = args.includes('--out')
  ? args[args.indexOf('--out') + 1]
  : path.join(process.env.TMPDIR ?? os.tmpdir(), 'pylon-preview');

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function contentHash(converted: ConvertedArticle): string {
  const hash = createHash('sha256');
  hash.update(converted.title);
  hash.update('\0');
  hash.update(converted.html);
  for (const image of converted.images) {
    hash.update('\0');
    hash.update(fs.readFileSync(image));
  }
  return hash.digest('hex');
}

async function resolveImages(converted: ConvertedArticle): Promise<string> {
  let html = converted.html;
  if (converted.images.length === 0) return html;

  for (const imagePath of converted.images) {
    const bytes = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const contentType =
      {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
      }[ext] ?? 'application/octet-stream';
    const uploaded = await uploadFile(
      path.basename(imagePath),
      bytes,
      contentType
    );
    html = html.replaceAll(
      `${IMAGE_PLACEHOLDER_PREFIX}${imagePath}`,
      uploaded.url
    );
    await sleep(WRITE_THROTTLE_MS);
  }
  return html;
}

const REDIRECTS_BEGIN = '# BEGIN pylon-kb redirects (generated)';
const REDIRECTS_END = '# END pylon-kb redirects (generated)';

// TOML basic strings: escape backslashes and double quotes (article URLs can
// contain literal quotes, e.g. …-Understanding-"CI-Execution-Failed").
function tomlString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/**
 * Rewrites the generated block in netlify.toml (between the BEGIN/END
 * markers) with one forced 301 per migrated article. force = true so these
 * win over the /docs/* catch-all rewrite, same as the other external
 * redirects in that file.
 */
function regenerateRedirects(mapping: Mapping, list: MigrationList): void {
  const rules: Array<{ from: string; to: string }> = [];
  for (const entry of Object.values(mapping).sort((a, b) =>
    a.docsPath.localeCompare(b.docsPath)
  )) {
    // Unpublished articles have no public URL yet — no redirect.
    if (!entry.url) continue;
    rules.push({ from: entry.docsPath, to: entry.url });
  }
  rules.push(...(list.extraRedirects ?? []));

  const block = [
    REDIRECTS_BEGIN,
    '# Managed by scripts/pylon/migrate-articles.ts — do not edit this block by hand.',
    '# Knowledge-base articles migrated to the Pylon KB (help.nx.app).',
    ...rules.flatMap((rule) => [
      '[[redirects]]',
      `from = ${tomlString(rule.from)}`,
      `to = ${tomlString(rule.to)}`,
      'status = 301',
      'force = true',
      '',
    ]),
    REDIRECTS_END,
  ].join('\n');

  const toml = fs.readFileSync(NETLIFY_TOML_PATH, 'utf-8');
  const begin = toml.indexOf(REDIRECTS_BEGIN);
  const end = toml.indexOf(REDIRECTS_END);
  let updated: string;
  if (begin !== -1 && end !== -1) {
    updated =
      toml.slice(0, begin) + block + toml.slice(end + REDIRECTS_END.length);
  } else {
    // First run: insert the block just before the /docs/* catch-all rewrite
    // (rules are processed in order; ours must come first).
    const anchor = toml.indexOf('# Rewrite for base path handling');
    if (anchor === -1) {
      throw new Error(
        `Cannot find the catch-all rewrite anchor in ${NETLIFY_TOML_PATH} to place generated redirects`
      );
    }
    updated = toml.slice(0, anchor) + block + '\n\n' + toml.slice(anchor);
  }
  fs.writeFileSync(NETLIFY_TOML_PATH, updated);
}

async function main(): Promise<void> {
  const list = readJson<MigrationList>(MIGRATION_LIST_PATH, { articles: [] });
  const mapping = readJson<Mapping>(MAPPING_PATH, {});

  let entries = list.articles;
  if (onlyFilter) {
    entries = entries.filter((e) => e.sourcePath.includes(onlyFilter));
  }
  if (entries.length === 0) {
    console.log(
      'Nothing to migrate (empty migration list or --only matched nothing).'
    );
    if (!dryRun) {
      // Redirects derive from the mapping, not the list — keep them fresh.
      regenerateRedirects(mapping, list);
      console.log(
        `Regenerated redirects in ${path.relative(ASTRO_DOCS_ROOT, NETLIFY_TOML_PATH)}`
      );
    }
    return;
  }

  if (dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const entry of entries) {
      const sourcePath = path.join(ASTRO_DOCS_ROOT, entry.sourcePath);
      const converted = convertArticle(sourcePath);
      const preview = path.join(
        outDir,
        path.basename(entry.sourcePath, '.mdoc') + '.html'
      );
      fs.writeFileSync(
        preview,
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${converted.title}</title></head>` +
          `<body><h1>${converted.title}</h1>${converted.html}</body></html>`
      );
      console.log(
        `[dry-run] ${entry.sourcePath} -> ${preview} ` +
          `(images: ${converted.images.length}, hash: ${contentHash(converted).slice(0, 12)})`
      );
    }
    console.log(`\nPreviews in ${outDir}. No network calls made.`);
    return;
  }

  if (!process.env.PYLON_API_TOKEN) {
    throw new Error('PYLON_API_TOKEN is required for a real migration run');
  }
  if (!NX_AUTHOR_USER_ID) {
    throw new Error(
      'NX_AUTHOR_USER_ID is empty in scripts/pylon/config.ts — set the canonical Nx author user id first'
    );
  }

  console.log('Listing existing Pylon articles for slug adoption…');
  const existing = await listArticles();
  const existingBySlug = new Map<string, PylonArticle>(
    existing.map((a) => [a.slug, a])
  );

  let posted = 0;
  let patched = 0;
  let skipped = 0;

  for (const entry of entries) {
    const sourcePath = path.join(ASTRO_DOCS_ROOT, entry.sourcePath);
    const converted = convertArticle(sourcePath);
    const hash = contentHash(converted);
    const slug = entry.slug ?? path.basename(entry.sourcePath, '.mdoc');

    let mapped = mapping[entry.sourcePath];
    if (!mapped && existingBySlug.has(slug)) {
      const orphan = existingBySlug.get(slug)!;
      console.log(
        `Adopting existing Pylon article for slug "${slug}" (${orphan.id})`
      );
      mapped = {
        pylonId: orphan.id,
        slug: orphan.slug,
        url: orphan.url,
        title: converted.title,
        description: converted.description,
        docsPath: converted.docsPath,
        contentHash: '',
        published: orphan.is_published,
        lastSyncedAt: '',
      };
      mapping[entry.sourcePath] = mapped;
    }

    const wantPublished = entry.publish && !noPublish;
    if (
      mapped &&
      mapped.contentHash === hash &&
      mapped.published === wantPublished
    ) {
      skipped++;
      console.log(`Skip (unchanged): ${entry.sourcePath}`);
      continue;
    }

    let html = await resolveImages(converted);

    if (mapped) {
      const urlUsed = mapped.url;
      const updated = await updateArticle(mapped.pylonId, {
        title: converted.title,
        body_html: converted.hasPageUrlPlaceholder
          ? html.replaceAll('{pageUrl}', urlUsed)
          : html,
        // Only ever publish, never unpublish: an article published via the
        // Pylon UI must not be taken down by a stale publish:false flag.
        ...(wantPublished ? { is_published: true } : {}),
      });
      patched++;
      const finalUrl = updated.url || mapped.url;
      console.log(
        `PATCH: ${entry.sourcePath} -> ${finalUrl || '(unpublished, no url)'}`
      );
      // Publishing assigns the public URL; re-substitute {pageUrl} if it
      // was unknown (or stale) when the body above was sent.
      if (converted.hasPageUrlPlaceholder && finalUrl && finalUrl !== urlUsed) {
        await sleep(WRITE_THROTTLE_MS);
        await updateArticle(mapped.pylonId, {
          body_html: html.replaceAll('{pageUrl}', finalUrl),
        });
      }
      mapping[entry.sourcePath] = {
        ...mapped,
        url: finalUrl,
        title: converted.title,
        description: converted.description,
        docsPath: converted.docsPath,
        contentHash: hash,
        published: wantPublished,
        lastSyncedAt: new Date().toISOString(),
        ...(entry.weight !== undefined ? { weight: entry.weight } : {}),
      };
    } else {
      const created = await createArticle({
        title: converted.title,
        author_user_id: NX_AUTHOR_USER_ID,
        body_html: html.replaceAll('{pageUrl}', ''),
        slug,
        collection_id: entry.collectionId,
        is_published: wantPublished,
      });
      posted++;
      console.log(
        `POST: ${entry.sourcePath} -> ${created.url || '(unpublished, no url)'}`
      );
      if (converted.hasPageUrlPlaceholder && created.url) {
        await sleep(WRITE_THROTTLE_MS);
        await updateArticle(created.id, {
          body_html: html.replaceAll('{pageUrl}', created.url),
        });
      }
      mapping[entry.sourcePath] = {
        pylonId: created.id,
        slug: created.slug,
        url: created.url ?? '',
        title: converted.title,
        description: converted.description,
        docsPath: converted.docsPath,
        contentHash: hash,
        published: wantPublished,
        lastSyncedAt: new Date().toISOString(),
        ...(entry.weight !== undefined ? { weight: entry.weight } : {}),
      };
    }
    writeJson(MAPPING_PATH, mapping);
    await sleep(WRITE_THROTTLE_MS);
  }

  regenerateRedirects(mapping, list);

  console.log(
    `\nDone: ${posted} created, ${patched} updated, ${skipped} unchanged.`
  );
  console.log(
    `Updated: ${path.relative(ASTRO_DOCS_ROOT, MAPPING_PATH)}, ` +
      `${path.relative(ASTRO_DOCS_ROOT, NETLIFY_TOML_PATH)}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
