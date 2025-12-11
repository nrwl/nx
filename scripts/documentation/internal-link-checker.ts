import { workspaceRoot } from '@nx/devkit';
import { XMLParser } from 'fast-xml-parser';
import * as glob from 'glob';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as parseLinks from 'parse-markdown-links';

const siteUrl = process.env.NX_DEV_URL || 'https://nx.dev';

console.log(`Using site URL: ${siteUrl}`);

/**
 * Check the integrity of internal links on nx-dev
 * - Error if a link present in markdown files target a non-existing nextjs app url
 * - Scans docs content, gather all links and validated them again nextjs sitemap.
 */
function readFileContents(path: string): string {
  return readFileSync(path, 'utf-8');
}

function isLinkInternal(linkPath: string): boolean {
  return (
    linkPath.startsWith('/') ||
    linkPath.startsWith('https://nx.dev') ||
    linkPath.startsWith('https://nx-dev') ||
    linkPath.startsWith(siteUrl)
  );
}

function isNotAsset(linkPath: string): boolean {
  return !linkPath.startsWith('/assets');
}

function isNotImage(linkPath: string): boolean {
  return (
    !linkPath.endsWith('.png') &&
    !linkPath.endsWith('.jpg') &&
    !linkPath.endsWith('.jpeg') &&
    !linkPath.endsWith('.gif') &&
    !linkPath.endsWith('.webp') &&
    !linkPath.endsWith('.svg') &&
    !linkPath.endsWith('.avif')
  );
}

function removeAnchors(linkPath: string): string {
  return linkPath.split('#')[0];
}

function removeQueryParams(linkPath: string): string {
  return linkPath.split('?')[0];
}

function extractAllLinks(basePath: string): Record<string, string[]> {
  return glob.sync(`${basePath}/*/**/*.md`).reduce((acc, path) => {
    const fileContents = readFileContents(path);
    const cardLinks = (fileContents.match(/url="(.*?)"/g) || []).map((v) =>
      v.slice(5, -1)
    );
    const links = parseLinks(fileContents)
      .concat(cardLinks)
      .filter(isLinkInternal)
      .filter(isNotAsset)
      .filter(isNotImage)
      .map(removeQueryParams);
    if (links.length) {
      acc[path.replace(basePath, '')] = links;
    }
    return acc;
  }, {});
}

function extractImageLinks(basePath: string): Record<string, string[]> {
  return glob.sync(`${basePath}/**/*.md`).reduce((acc, path) => {
    const fileContents = readFileContents(path);
    const imageLinks = Array.from(
      fileContents.matchAll(/!\[.*?\]\((.*?)\)/g)
    ).map((matches) => decodeURI(matches[1]));
    if (imageLinks.length) {
      acc[path.replace(basePath, '')] = imageLinks;
    }
    return acc;
  }, {});
}

function readSiteMapIndex(directoryPath: string, filename: string): string[] {
  const parser = new XMLParser();
  const sitemapIndex: {
    sitemapindex: {
      sitemap:
        | Array<{
            loc: string;
          }>
        | { loc: string };
    };
  } = parser.parse(readFileContents(join(directoryPath, filename)));

  if (!sitemapIndex.sitemapindex) {
    throw new Error(
      `Invalid sitemap index file: ${join(
        directoryPath,
        filename
      )}. Expected sitemap to have sitemapIndex property`
    );
  }

  const internalSitemap = Array.isArray(sitemapIndex.sitemapindex.sitemap)
    ? sitemapIndex.sitemapindex.sitemap.find(
        (s) => !s.loc.endsWith('sitemap-index.xml')
      )
    : sitemapIndex.sitemapindex.sitemap;

  if (!internalSitemap) {
    console.warn(join(directoryPath, filename), sitemapIndex);
    throw new Error('Unable to find sitemap location for nx.dev');
  }

  console.log('Using sitemap with url: ', internalSitemap.loc);
  return [
    join(
      directoryPath,
      internalSitemap.loc.replace(siteUrl, '').replace('https://nx.dev', '')
    ),
  ];
}

function readSiteMapLinks(filePath: string): string[] {
  console.log('Reading sitemap links from: ', filePath);
  const parser = new XMLParser();
  const sitemap: {
    urlset: {
      url: {
        loc: string;
        changefreq: string;
        priority: number;
        lastmod: string;
      }[];
    };
  } = parser.parse(readFileContents(filePath));
  return sitemap.urlset.url.map((obj) => obj.loc);
}

// Main
const documentLinks = extractAllLinks(join(workspaceRoot, 'docs'));

// Read Next.js sitemap URLs
const nextjsSitemapUrls = readSiteMapIndex(
  join(workspaceRoot, 'dist/nx-dev/nx-dev/public/'),
  'sitemap.xml'
).flatMap((path) => readSiteMapLinks(path));
console.log(nextjsSitemapUrls.length + ' URLs found in Next.js sitemap');

// Read Astro sitemap URLs
const astroSitemapUrls = readSiteMapIndex(
  join(workspaceRoot, 'astro-docs/dist/'),
  'sitemap-index.xml'
  // astro-docs links are prefixed with /docs, but that isn't reflected in the file paths
).flatMap((path) => readSiteMapLinks(path.replace('/docs/', '/')));
console.log(astroSitemapUrls.length + ' URLs found in Astro sitemap');
// Combine all sitemap URLs into a single set
const sitemapUrls = [...new Set([...nextjsSitemapUrls, ...astroSitemapUrls])];

function headerToAnchor(line: string): string {
  return line
    .replace(/[#]+ /, '')
    .replace(/`.*`/, '')
    .replace(/[^\w ]/g, '')
    .trim()
    .replace(/ +/g, '-')
    .toLocaleLowerCase();
}

const ignoreAnchorUrls = [
  '/reference/core-api',
  '/technologies',
  '/nx-cloud',
  '/blog',
  '/pricing',
  '/ci/reference',
  '/changelog',
  '/conf',
  // NOTE: ignore astro docs anchor links since
  // we don't have a simple way to get all header contents from src at this point
  '/docs',
];

const errors: Array<{ file: string; link: string }> = [];
const localLinkErrors: Array<{ file: string; link: string }> = [];
for (let file in documentLinks) {
  for (let link of documentLinks[file]) {
    if (
      link.startsWith('https://nx.dev') ||
      link.startsWith('https://nx-dev') ||
      link.startsWith(siteUrl)
    ) {
      localLinkErrors.push({ file, link });
    } else if (
      link.includes('#') &&
      !ignoreAnchorUrls.some((ignoreAnchorUrl) =>
        link.startsWith(ignoreAnchorUrl)
      )
    ) {
      errors.push({ file, link });
    } else if (
      !link.includes('#') &&
      !sitemapUrls.includes(['https://nx.dev', link].join('')) &&
      !sitemapUrls.includes([siteUrl, link].join(''))
    ) {
      errors.push({ file, link });
    } else if (
      link.includes('#') &&
      ignoreAnchorUrls.some((ignoreAnchorUrl) =>
        link.startsWith(ignoreAnchorUrl)
      ) &&
      !sitemapUrls.includes(['https://nx.dev', removeAnchors(link)].join('')) &&
      !sitemapUrls.includes([siteUrl, removeAnchors(link)].join(''))
    ) {
      errors.push({ file, link });
    }
  }
}

const imageUrls = extractImageLinks(join(workspaceRoot, 'docs'));
for (let file in imageUrls) {
  for (let link of imageUrls[file]) {
    if (!existsSync(join(workspaceRoot, 'docs', link))) {
      errors.push({ file, link });
    }
  }
}

console.log(`i/ Internal Link Check`);
if (errors.length || localLinkErrors.length) {
  if (errors.length) {
    console.log(`ERROR\n${errors.length} links are pointing to nowhere:`);
    errors.forEach((error) => {
      console.error(`⚠ File:${error.file}\n -> ${error.link}\n`);
    });
  }
  if (localLinkErrors.length) {
    console.log(
      `ERROR\n${localLinkErrors.length} local links should not include the domain:`
    );
    localLinkErrors.forEach((error) => {
      console.error(`⚠ File:${error.file}\n -> ${error.link}\n`);
    });
  }
  process.exit(1);
}
console.log(`i/ No internal 404 link detected.`);
process.exit(0);
