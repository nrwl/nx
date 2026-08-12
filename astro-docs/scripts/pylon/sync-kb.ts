/**
 * Mirrors `astro-docs/src/content/docs/kb` into the Pylon knowledge base.
 *
 * nx.dev stays canonical: this only pushes copies so Pylon can suggest them as
 * answers in the support widget. Nothing outside `/docs/kb` is touched, and
 * writes are confined to a single Pylon collection so the hand-written
 * enterprise articles that live beside them are never modified.
 *
 * Usage:
 *   PYLON_API_TOKEN=... tsx scripts/pylon/sync-kb.ts [options]
 *
 *   --dry-run          report what would change without writing
 *   --prune            delete articles whose source page no longer exists
 *   --strict           exit non-zero when any article produces a warning
 *   --only=<slug>      restrict the run to one article
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSET_PLACEHOLDER_PREFIX,
  convertArticle,
  type AssetRef,
} from './markdoc-to-html.ts';
import { PylonClient, type PylonArticle } from './pylon-client.ts';

/** "Nrwl Knowledge Base" on help.nx.app. */
const KNOWLEDGE_BASE_ID = 'e35aaa8d-4b65-4024-98c0-8e508846a027';
/**
 * "Nx Knowledge Base". Every article this script owns lives here; the
 * hand-written "Nx Cloud Enterprise" collection is deliberately out of scope.
 */
const COLLECTION_ID = 'bd2e85a6-896a-457f-9540-8bc5a5cb4e8b';

const SITE_URL = 'https://nx.dev';
const DOCS_BASE = '/docs/kb';

/**
 * Articles stay unlisted so nx.dev remains the SEO canonical for this content.
 * Unlisted articles are still reachable by direct link, which is how a
 * suggested answer surfaces them.
 */
const IS_UNLISTED = true;

/** A prune this large means the source directory failed to resolve, not a real deletion. */
const MAX_PRUNE_RATIO = 0.25;

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const astroDocsRoot = resolve(scriptDir, '../..');
const repoRoot = resolve(astroDocsRoot, '..');
const kbDir = resolve(astroDocsRoot, 'src/content/docs/kb');
const publicDir = resolve(astroDocsRoot, 'public');

interface Options {
  dryRun: boolean;
  prune: boolean;
  strict: boolean;
  only?: string;
}

interface SourceArticle {
  slug: string;
  title: string;
  html: string;
  assets: AssetRef[];
  warnings: string[];
}

function parseOptions(argv: string[]): Options {
  const only = argv
    .find((arg) => arg.startsWith('--only='))
    ?.slice('--only='.length);
  const unknown = argv.filter(
    (arg) =>
      !['--dry-run', '--prune', '--strict'].includes(arg) &&
      !arg.startsWith('--only=')
  );
  if (unknown.length) {
    throw new Error(`Unknown option(s): ${unknown.join(', ')}`);
  }
  return {
    dryRun: argv.includes('--dry-run'),
    prune: argv.includes('--prune'),
    strict: argv.includes('--strict'),
    only,
  };
}

function readSourceArticles(options: Options): SourceArticle[] {
  const files = readdirSync(kbDir)
    .filter((file) => file.endsWith('.mdoc'))
    .sort();

  const articles: SourceArticle[] = [];
  for (const file of files) {
    const slug = basename(file, '.mdoc');
    if (options.only && options.only !== slug) continue;

    const sourcePath = resolve(kbDir, file);
    const converted = convertArticle(readFileSync(sourcePath, 'utf8'), {
      sourcePath,
      publicDir,
      repoRoot,
      canonicalUrl: `${SITE_URL}${DOCS_BASE}/${slug}`,
      siteUrl: SITE_URL,
    });

    if (!converted.title) {
      throw new Error(`${file} has no title in its frontmatter`);
    }

    articles.push({
      slug,
      title: converted.title,
      html: converted.html,
      assets: converted.assets,
      warnings: converted.warnings,
    });
  }

  if (options.only && articles.length === 0) {
    throw new Error(`No article matches --only=${options.only}`);
  }
  return articles;
}

function bodyOf(article: PylonArticle): string {
  return (
    article.current_published_content_html ||
    article.current_draft_content_html ||
    ''
  );
}

/**
 * Recovers the CDN URL already uploaded for each image, keyed by the
 * `data-nx-src` marker a previous run embedded next to it. Without this every
 * nightly run would re-upload the same files under new URLs and every article
 * would look changed.
 */
function collectUploadedAssets(articles: PylonArticle[]): Map<string, string> {
  const uploaded = new Map<string, string>();
  const imgPattern = /<img[^>]*\ssrc="([^"]+)"[^>]*\sdata-nx-src="([^"]+)"/g;

  for (const article of articles) {
    for (const [, url, key] of bodyOf(article).matchAll(imgPattern)) {
      if (!url.startsWith(ASSET_PLACEHOLDER_PREFIX)) {
        uploaded.set(decodeAttribute(key), url);
      }
    }
  }
  return uploaded;
}

function decodeAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

async function resolveAssets(
  article: SourceArticle,
  uploaded: Map<string, string>,
  client: PylonClient,
  options: Options
): Promise<{ html: string; uploads: number }> {
  let html = article.html;
  let uploads = 0;

  for (const asset of article.assets) {
    let url = uploaded.get(asset.key);
    if (!url) {
      if (options.dryRun) {
        // Leave the placeholder in place; the comparison below will report the
        // article as changed, which is the honest answer for a new image.
        continue;
      }
      url = await client.uploadAttachment(
        asset.fileName,
        readFileSync(asset.absolutePath),
        asset.contentType
      );
      uploaded.set(asset.key, url);
      uploads++;
    }
    html = html.replaceAll(
      `${ASSET_PLACEHOLDER_PREFIX}${asset.key}`,
      url.replaceAll('&', '&amp;')
    );
  }

  return { html, uploads };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  const token = process.env.PYLON_API_TOKEN;
  if (!token) throw new Error('PYLON_API_TOKEN is not set');

  const client = new PylonClient({ token, knowledgeBaseId: KNOWLEDGE_BASE_ID });
  // Falsy rather than nullish: an unset Actions variable arrives as an empty
  // string, which would otherwise be sent as the author of every new article.
  const authorUserId =
    process.env.PYLON_AUTHOR_USER_ID || (await client.getAuthenticatedUserId());

  const sources = readSourceArticles(options);
  const allRemote = await client.listArticles();
  const remote = allRemote.filter(
    (article) => article.collection_id === COLLECTION_ID
  );
  const remoteBySlug = new Map(
    remote.map((article) => [article.slug, article])
  );
  const uploaded = collectUploadedAssets(allRemote);

  console.log(
    `${sources.length} source article(s), ${remote.length} already in the Pylon collection` +
      (options.dryRun ? ' (dry run)' : '')
  );

  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  let uploads = 0;

  for (const source of sources) {
    for (const warning of source.warnings) {
      warnings.push(`${source.slug}: ${warning}`);
    }

    const resolved = await resolveAssets(source, uploaded, client, options);
    uploads += resolved.uploads;

    const existing = remoteBySlug.get(source.slug);
    if (!existing) {
      created.push(source.slug);
      if (!options.dryRun) {
        await client.createArticle({
          title: source.title,
          slug: source.slug,
          author_user_id: authorUserId,
          collection_id: COLLECTION_ID,
          body_html: resolved.html,
          is_published: true,
          is_unlisted: IS_UNLISTED,
        });
      }
      continue;
    }

    const unchanged =
      bodyOf(existing) === resolved.html &&
      existing.title === source.title &&
      existing.is_published &&
      existing.is_unlisted === IS_UNLISTED;

    if (unchanged) {
      skipped.push(source.slug);
      continue;
    }

    updated.push(source.slug);
    if (!options.dryRun) {
      await client.updateArticle(existing.id, {
        title: source.title,
        body_html: resolved.html,
        is_published: true,
        is_unlisted: IS_UNLISTED,
        publish_updated_body_html: true,
      });
    }
  }

  const sourceSlugs = new Set(sources.map((source) => source.slug));
  // A partial run cannot tell a deleted page from one it was told to skip.
  const orphans = options.only
    ? []
    : remote.filter((article) => !sourceSlugs.has(article.slug));

  if (orphans.length && options.prune) {
    if (orphans.length > remote.length * MAX_PRUNE_RATIO) {
      throw new Error(
        `Refusing to prune ${orphans.length} of ${remote.length} articles. ` +
          `Re-run without --prune and confirm the source directory resolved correctly.`
      );
    }
    for (const orphan of orphans) {
      if (!options.dryRun) await client.deleteArticle(orphan.id);
    }
  }

  console.log(
    [
      '',
      `created: ${created.length}`,
      `updated: ${updated.length}`,
      `unchanged: ${skipped.length}`,
      `images uploaded: ${uploads}`,
      `orphaned in Pylon: ${orphans.length}${
        orphans.length
          ? options.prune
            ? ' (pruned)'
            : ' (use --prune to delete)'
          : ''
      }`,
    ].join('\n')
  );

  for (const [label, slugs] of [
    ['create', created],
    ['update', updated],
  ] as const) {
    if (slugs.length) console.log(`\n${label}:\n  ${slugs.join('\n  ')}`);
  }
  if (orphans.length) {
    console.log(
      `\norphaned:\n  ${orphans.map((article) => article.slug).join('\n  ')}`
    );
  }
  if (warnings.length) {
    console.log(`\nwarnings (${warnings.length}):\n  ${warnings.join('\n  ')}`);
  }

  if (options.strict && warnings.length) {
    throw new Error(`${warnings.length} warning(s) with --strict`);
  }
}

main().catch((error) => {
  console.error(`\npylon kb sync failed: ${error.message}`);
  process.exit(1);
});
