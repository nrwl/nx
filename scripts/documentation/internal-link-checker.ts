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
      .filter(isNotImage);
    // .map(removeAnchors);
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
const sitemapUrls = readSiteMapIndex(
  join(workspaceRoot, 'dist/nx-dev/nx-dev/public/'),
  'sitemap.xml'
).flatMap((path) => readSiteMapLinks(path));

function headerToAnchor(line: string): string {
  return line
    .replace(/[#]+ /, '')
    .replace(/`/g, '') // Remove all backticks
    .replace(/[^\w -]/g, '') // Allow hyphens and spaces
    .trim()
    .replace(/ +/g, '-')
    .toLocaleLowerCase();
}

function isValidLink(
  link: string,
  anchorUrls: string[],
  sitemapUrls: string[],
  ignoreAnchorUrls: string[]
): boolean {
  if (!link.includes('#')) {
    // Check for special cases like blog posts, recipes, etc.
    if (
      link.startsWith('/blog/') ||
      link.startsWith('/community/') ||
      link.startsWith('/recipes/')
    ) {
      return true; // Assume these special pages are valid
    }
    return sitemapUrls.includes(['https://nx.dev', link].join(''));
  }

  const [baseUrl, anchor] = link.split('#');

  // Check if the link should be ignored for anchor checking
  if (ignoreAnchorUrls.some((ignoreUrl) => link.startsWith(ignoreUrl))) {
    return true; // Consider ignored URLs as valid
  }

  // Check for special cases like blog posts, recipes, etc.
  if (
    baseUrl.startsWith('/blog/') ||
    baseUrl.startsWith('/community/') ||
    baseUrl.startsWith('/recipes/')
  ) {
    return true; // Assume these special pages are valid
  }

  const fullBaseUrl = ['https://nx.dev', baseUrl].join('');

  // Check if the base URL exists in the sitemap
  if (!sitemapUrls.includes(fullBaseUrl)) {
    return false;
  }

  // Find potential matches for the given base URL
  const potentialMatches = anchorUrls.filter((url) => url.startsWith(baseUrl));

  // If no potential matches found, assume the anchor is valid for dynamic content
  if (potentialMatches.length === 0) {
    return true;
  }

  // Check if the exact anchor exists
  if (potentialMatches.some((match) => match.endsWith('#' + anchor))) {
    return true;
  }

  // If not found, try a more lenient match
  const normalizedAnchor = anchor.replace(/[^\w-]/g, '').toLowerCase();
  return potentialMatches.some((match) => {
    const matchAnchor = match.split('#')[1];
    const normalizedMatchAnchor = matchAnchor
      .replace(/[^\w-]/g, '')
      .toLowerCase();
    return normalizedMatchAnchor === normalizedAnchor;
  });
}

function readApiJson(manifestFileName: string): string[] {
  const manifest = JSON.parse(
    readFileContents(
      join(
        workspaceRoot,
        'dist/nx-dev/nx-dev/public/documentation/generated/manifests',
        manifestFileName
      )
    )
  );
  let entries = Object.entries(manifest);
  return entries
    .filter(
      ([url, details]: [string, any]) =>
        !!details.file &&
        existsSync(join(workspaceRoot, 'docs', details.file + '.md'))
    )
    .flatMap(([url, details]: [string, any]) => {
      const headers = readFileContents(
        join(workspaceRoot, 'docs', details.file + '.md')
      )
        .split('\n')
        .filter((line) => line.startsWith('#'))
        .map(headerToAnchor)
        .map((line) => url + '#' + line);
      return headers;
    });
}

const anchorUrls = ['nx.json', 'ci.json', 'extending-nx.json'].flatMap(
  (manifestFileName) => readApiJson(manifestFileName)
);
const ignoreAnchorUrls = ['/nx-api', '/blog', '/pricing', '/ci/reference'];

const errors: Array<{ file: string; link: string }> = [];
const localLinkErrors: Array<{ file: string; link: string }> = [];
for (let file in documentLinks) {
  for (let link of documentLinks[file]) {
    if (link.startsWith('https://nx.dev')) {
      localLinkErrors.push({ file, link });
    } else if (!isValidLink(link, anchorUrls, sitemapUrls, ignoreAnchorUrls)) {
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
