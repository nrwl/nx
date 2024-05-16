import { workspaceRoot } from '@nx/devkit';
import { XMLParser } from 'fast-xml-parser';
import * as glob from 'glob';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as parseLinks from 'parse-markdown-links';

/**
 * Check the integrity of internal links on nx-dev
 * - Error if a link present in markdown files target a non-existing nextjs app url
 * - Scans docs content, gather all links and validated them again nextjs sitemap.
 */
function readFileContents(path: string): string {
  return readFileSync(path, 'utf-8');
}
function isLinkInternal(linkPath: string): boolean {
  return linkPath.startsWith('/') || linkPath.startsWith('https://nx.dev');
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
      .map(removeAnchors);
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
      sitemap: {
        loc: string;
      };
    };
  } = parser.parse(readFileContents(join(directoryPath, filename)));
  return [
    join(
      directoryPath,
      sitemapIndex.sitemapindex.sitemap.loc.replace('https://nx.dev', '')
    ),
  ];
}
function readSiteMapLinks(filePath: string): string[] {
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
const sitemapLinks = readSiteMapIndex(
  join(workspaceRoot, 'dist/nx-dev/nx-dev/public/'),
  'sitemap.xml'
).flatMap((path) => readSiteMapLinks(path));
const errors: Array<{ file: string; link: string }> = [];
const localLinkErrors: Array<{ file: string; link: string }> = [];
for (let file in documentLinks) {
  for (let link of documentLinks[file]) {
    if (link.startsWith('https://nx.dev')) {
      localLinkErrors.push({ file, link });
    } else if (!sitemapLinks.includes(['https://nx.dev', link].join(''))) {
      errors.push({ file, link });
    }
  }
}

const imageLinks = extractImageLinks(join(workspaceRoot, 'docs'));
for (let file in imageLinks) {
  for (let link of imageLinks[file]) {
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
