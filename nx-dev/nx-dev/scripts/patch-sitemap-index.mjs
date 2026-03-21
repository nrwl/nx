/**
 * Patches the generated sitemap.xml index to include additional sitemaps
 * that next-sitemap doesn't natively support adding to the index.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const siteUrl = process.env.NX_DEV_URL || 'https://nx.dev';
const outDir = resolve(import.meta.dirname, '../public');

const sitemapPath = resolve(outDir, 'sitemap.xml');

const additionalSitemaps = [
  `${siteUrl}/sitemap-1.xml`,
  `${siteUrl}/docs/sitemap-index.xml`,
];

const xml = readFileSync(sitemapPath, 'utf-8');

const entries = additionalSitemaps
  .map((url) => `<sitemap><loc>${url}</loc></sitemap>`)
  .join('');

const patched = xml.replace('</sitemapindex>', `${entries}</sitemapindex>`);

writeFileSync(sitemapPath, patched);
console.log(
  `Patched sitemap.xml with ${additionalSitemaps.length} additional sitemaps`
);
