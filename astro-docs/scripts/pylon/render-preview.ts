/**
 * Renders `/docs/kb` articles through the Pylon converter without touching the
 * API, so conversion changes can be reviewed offline.
 *
 * Usage:
 *   tsx scripts/pylon/render-preview.ts                 # census + warnings
 *   tsx scripts/pylon/render-preview.ts --strict        # fail on any warning
 *   tsx scripts/pylon/render-preview.ts <slug>          # print one article
 *   tsx scripts/pylon/render-preview.ts <slug> --out=f  # write it to a file
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertArticle } from './markdoc-to-html.ts';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const astroDocsRoot = resolve(scriptDir, '../..');
const repoRoot = resolve(astroDocsRoot, '..');
const kbDir = resolve(astroDocsRoot, 'src/content/docs/kb');
const publicDir = resolve(astroDocsRoot, 'public');

const args = process.argv.slice(2);
const outFile = args
  .find((arg) => arg.startsWith('--out='))
  ?.slice('--out='.length);
const only = args.find((arg) => !arg.startsWith('--'));

function convert(slug: string) {
  const sourcePath = resolve(kbDir, `${slug}.mdoc`);
  return convertArticle(readFileSync(sourcePath, 'utf8'), {
    sourcePath,
    publicDir,
    repoRoot,
    canonicalUrl: `https://nx.dev/docs/kb/${slug}`,
    siteUrl: 'https://nx.dev',
  });
}

if (only) {
  const result = convert(only);
  const html = result.html;
  if (outFile) {
    writeFileSync(outFile, html);
    console.log(`wrote ${html.length} bytes to ${outFile}`);
  } else {
    console.log(html);
  }
  console.log(`\ntitle: ${result.title}`);
  console.log(`assets: ${result.assets.length}`);
  if (result.warnings.length)
    console.log(`warnings:\n  ${result.warnings.join('\n  ')}`);
} else {
  const slugs = readdirSync(kbDir)
    .filter((file) => file.endsWith('.mdoc'))
    .map((file) => basename(file, '.mdoc'))
    .sort();

  const elementCounts: Record<string, number> = {};
  const allWarnings: string[] = [];
  let totalBytes = 0;
  let totalAssets = 0;

  for (const slug of slugs) {
    const result = convert(slug);
    totalBytes += result.html.length;
    totalAssets += result.assets.length;
    for (const warning of result.warnings)
      allWarnings.push(`${slug}: ${warning}`);
    for (const [, tag] of result.html.matchAll(/<([a-z][a-z0-9]*)[\s/>]/g))
      elementCounts[tag] = (elementCounts[tag] ?? 0) + 1;
  }

  console.log(`articles: ${slugs.length}`);
  console.log(`html bytes: ${totalBytes.toLocaleString()}`);
  console.log(`image references: ${totalAssets}`);
  console.log(
    `\nelements:\n  ${Object.entries(elementCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => `${tag}:${count}`)
      .join('  ')}`
  );
  console.log(
    allWarnings.length
      ? `\nwarnings (${allWarnings.length}):\n  ${allWarnings.join('\n  ')}`
      : '\nno warnings'
  );

  // An unsupported tag or a missing image degrades the synced article, so CI
  // should reject it here rather than let the nightly publish it.
  if (args.includes('--strict') && allWarnings.length) {
    console.error(
      `\n${allWarnings.length} conversion warning(s) with --strict`
    );
    process.exit(1);
  }
}
