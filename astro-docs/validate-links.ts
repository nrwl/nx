import fs from 'node:fs';
import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import glob from 'glob';

// Links to pages hosted outside of both astro-docs and nx-dev sites
const ignoredLinks = ['/contact'];

// These are more so until we cut over and can modify production file links
const filesToIgnore = [
  '/executors/index.html',
  '/generators/index.html',
  '/migrations/index.html',
  '/nx-commands/index.html',
];

const distDir = path.join(workspaceRoot, 'astro-docs', 'dist');
const sitemapIndexPath = path.join(distDir, 'sitemap-index.xml');
const sitemapFallbackPath = path.join(distDir, 'sitemap-0.xml');
const nxDevSitemapPath = path.join(
  workspaceRoot,
  'dist',
  'nx-dev',
  'nx-dev',
  'public',
  'sitemap-0.xml'
);

if (!fs.existsSync(distDir)) {
  console.error(
    `Dist directory does not exist at path Have you ran the build?: ${distDir}`
  );
  process.exit(1);
}

if (!fs.existsSync(sitemapIndexPath) && !fs.existsSync(sitemapFallbackPath)) {
  console.error(
    `No sitemap found at ${sitemapIndexPath} or ${sitemapFallbackPath}. Have you ran the build?`
  );
  process.exit(1);
}

function findHtmlFiles(dir: string, files: string[] = []) {
  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findHtmlFiles(fullPath, files);
      } else if (item.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  } catch (err: any) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return files;
}

function extractInternalLinks(htmlContent: string, filePath: string) {
  const links = new Set<string>();

  // NOTE: surely regex parsing html won't blow up in my face
  // Regex to match href attributes in anchor tags
  const hrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = hrefRegex.exec(htmlContent)) !== null) {
    const href = match[1];

    if (
      // Skip external links
      href.startsWith('http') ||
      // skip anchor links
      href.startsWith('#') ||
      // skip any mailto links
      href.startsWith('mailto')
    ) {
      continue;
    }

    try {
      const cleanLink = new URL(href, 'http://localhost');
      links.add(cleanLink.pathname);
    } catch (error) {
      console.error(`Unable to parse link for validation: ${href}`, error);
      process.exit(1);
    }
  }

  return links;
}

function parseSitemap(sitemapContent: string) {
  const routes = new Set<string>();

  // Extract all <loc> URLs from the sitemap
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(sitemapContent)) !== null) {
    const url = match[1];

    const parsedUrl = new URL(url);

    routes.add(parsedUrl.pathname);
  }

  return routes;
}

/**
 * Parses sitemap-index.xml to discover all sitemap files,
 * then merges routes from all of them.
 * Falls back to sitemap-0.xml if sitemap-index.xml doesn't exist.
 */
function loadAllSitemapRoutes(): Set<string> {
  const allRoutes = new Set<string>();

  // Load astro-docs sitemap routes
  if (fs.existsSync(sitemapIndexPath)) {
    const indexContent = fs.readFileSync(sitemapIndexPath, 'utf-8');
    const locRegex = /<loc>([^<]+)<\/loc>/gi;
    const sitemapUrls: string[] = [];
    let match;

    while ((match = locRegex.exec(indexContent)) !== null) {
      sitemapUrls.push(match[1]);
    }

    for (const sitemapUrl of sitemapUrls) {
      const parsedUrl = new URL(sitemapUrl);
      const filename = path.basename(parsedUrl.pathname);
      const sitemapFilePath = path.join(distDir, filename);

      if (!fs.existsSync(sitemapFilePath)) {
        console.warn(
          `Sitemap file referenced in index not found: ${sitemapFilePath}`
        );
        continue;
      }

      const sitemapContent = fs.readFileSync(sitemapFilePath, 'utf-8');
      const routes = parseSitemap(sitemapContent);
      for (const route of routes) {
        allRoutes.add(route);
      }
    }
  } else {
    // Fallback to sitemap-0.xml
    const sitemapContent = fs.readFileSync(sitemapFallbackPath, 'utf-8');
    for (const route of parseSitemap(sitemapContent)) {
      allRoutes.add(route);
    }
  }

  // Load nx-dev (Next.js) sitemap routes for cross-site validation
  if (fs.existsSync(nxDevSitemapPath)) {
    const nxDevSitemapContent = fs.readFileSync(nxDevSitemapPath, 'utf-8');
    const nxDevRoutes = parseSitemap(nxDevSitemapContent);
    console.log(
      `Found ${nxDevRoutes.size} routes in nx-dev sitemap (${nxDevSitemapPath})`
    );
    for (const route of nxDevRoutes) {
      allRoutes.add(route);
    }
  } else {
    console.warn(
      `nx-dev sitemap not found at ${nxDevSitemapPath}. Run "nx build nx-dev" to enable cross-site link validation against nx-dev routes.`
    );
  }

  return allRoutes;
}

function toFriendlyName(file: string) {
  // TODO: resolve to the actual markdown file if possile?
  return path.relative(workspaceRoot, file);
}

/**
 * Extracts links pointing to /docs/ paths from markdown file content.
 * Handles both markdown links like [text](/docs/...) and card url attributes like url="/docs/..."
 */
function extractDocsLinksFromMarkdown(content: string): Set<string> {
  const links = new Set<string>();

  // Match markdown links: [text](/docs/...)
  const markdownLinkRegex = /\]\(\/docs\/[^)]*\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    // Extract the path from ](/docs/...)
    const linkPath = match[0].slice(2, -1);
    // Strip anchors and query params
    const clean = linkPath.split('#')[0].split('?')[0];
    links.add(clean);
  }

  // Match card url attributes: url="/docs/..."
  const urlAttrRegex = /url="(\/docs\/[^"]*)"/g;
  while ((match = urlAttrRegex.exec(content)) !== null) {
    const linkPath = match[1];
    const clean = linkPath.split('#')[0].split('?')[0];
    links.add(clean);
  }

  // Match reference-style links: [ref]: /docs/...
  const refStyleRegex = /^\s*\[[^\]]+\]:\s*(\/docs\/\S*)/gm;
  while ((match = refStyleRegex.exec(content)) !== null) {
    const linkPath = match[1];
    const clean = linkPath.split('#')[0].split('?')[0];
    links.add(clean);
  }

  // Match card url attributes without leading slash: url="docs/..."
  const urlAttrNoSlashRegex = /url="(docs\/[^"]*)"/g;
  while ((match = urlAttrNoSlashRegex.exec(content)) !== null) {
    const linkPath = '/' + match[1]; // normalize by prepending /
    const clean = linkPath.split('#')[0].split('?')[0];
    links.add(clean);
  }

  return links;
}

/**
 * Scans docs/ markdown files for links to /docs/ paths (astro-docs pages)
 * and validates them against the astro sitemap.
 * Returns broken links grouped by source file.
 */
function validateCrossSiteLinks(
  availableInternalRoutes: Set<string>
): Map<string, string[]> {
  const docsDir = path.join(workspaceRoot, 'docs');
  const crossSiteBrokenLinks = new Map<string, string[]>();

  if (!fs.existsSync(docsDir)) {
    console.warn(
      `docs/ directory not found at ${docsDir}, skipping cross-site link check`
    );
    return crossSiteBrokenLinks;
  }

  const mdFiles = glob.sync('**/*.md', { cwd: docsDir });
  console.log(`Found ${mdFiles.length} markdown files in docs/\n`);

  let totalLinks = 0;

  for (const relPath of mdFiles) {
    const fullPath = path.join(docsDir, relPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const docsLinks = extractDocsLinksFromMarkdown(content);

    for (const link of docsLinks) {
      totalLinks++;

      if (!availableInternalRoutes.has(link)) {
        const existing = crossSiteBrokenLinks.get(relPath);
        if (existing) {
          existing.push(link);
        } else {
          crossSiteBrokenLinks.set(relPath, [link]);
        }
      }
    }
  }

  console.log(
    `Checked ${totalLinks} cross-site links from docs/ to /docs/ astro pages\n`
  );

  return crossSiteBrokenLinks;
}

function validateLinks() {
  const linksToFiles = new Map<string, string[]>();

  console.log('🔍 Starting link validation...\n');

  console.log('📁 Finding HTML files in dist directory...');
  const htmlFiles = findHtmlFiles(distDir);
  console.log(`Found ${htmlFiles.length} HTML files\n`);

  console.log('🔗 Extracting internal links...');
  for (const file of htmlFiles) {
    if (filesToIgnore.some((f) => file.includes(f))) {
      console.log(`Skipping file since matching manual exclude list: ${file}`);
      continue;
    }
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const links = extractInternalLinks(content, file);

      links.forEach((link) => {
        const existing = linksToFiles.get(link);
        if (existing) {
          existing.push(file);
          linksToFiles.set(link, existing);
        } else {
          linksToFiles.set(link, [file]);
        }
      });
    } catch (err) {
      console.error(`Error reading file ${file}:`, err);
      process.exit(1);
    }
  }

  const filteredLinks = Array.from(linksToFiles.keys()).filter(
    (href) => !ignoredLinks.some((il) => href.includes(il))
  );

  const actualLinksUsed = new Set(filteredLinks);
  console.log(
    `Extracted ${actualLinksUsed.size} total internal links from ${htmlFiles.length} files\n`
  );

  console.log('📍 Parsing sitemap for valid routes...');

  const availableInternalRoutes = loadAllSitemapRoutes();
  console.log(
    `Found ${availableInternalRoutes.size} unique routes in sitemap\n`
  );

  console.log('✅ Validating astro internal links...\n');

  // Find links that exist in actualLinksUsed but not in availableInternalRoutes
  const brokenLinks: Set<string> = new Set(
    [...actualLinksUsed].filter((link) => !availableInternalRoutes.has(link))
  );

  let hasBrokenLinks = false;

  if (brokenLinks.size > 0) {
    hasBrokenLinks = true;
    console.log(`Found ${brokenLinks.size} broken links:\n`);

    const filesWithErrors = new Map<string, string[]>();

    brokenLinks.forEach((link) => {
      const files = linksToFiles.get(link);

      if (!files) {
        throw new Error(
          `Unable to find file where link was parsed from: ${link}`
        );
      }

      files.forEach((f) => {
        const existing = filesWithErrors.get(f);
        if (existing) {
          existing.push(link);
          filesWithErrors.set(f, existing);
        } else {
          filesWithErrors.set(f, [link]);
        }
      });
    });

    for (const [file, badLinks] of filesWithErrors) {
      console.log(
        `\n❌ ${toFriendlyName(file)} has ${badLinks.length} broken links:`
      );
      badLinks.forEach((link) => console.log(`\t- ${link}`));
    }

    console.log(
      `\n🔎 Check the above output to resolve the ${brokenLinks.size} broken links in each respecitve source (.mdoc, .astro, and/or content collection generation`
    );
  }

  // Cross-site validation: check docs/ markdown links to /docs/ astro pages
  console.log(
    '\n🔗 Validating cross-site links from docs/ markdown to astro pages...\n'
  );
  const crossSiteBrokenLinks = validateCrossSiteLinks(availableInternalRoutes);

  if (crossSiteBrokenLinks.size > 0) {
    hasBrokenLinks = true;
    let totalCrossSiteBroken = 0;
    for (const [file, badLinks] of crossSiteBrokenLinks) {
      totalCrossSiteBroken += badLinks.length;
      console.log(
        `\n❌ docs/${file} has ${badLinks.length} broken cross-site links:`
      );
      badLinks.forEach((link) => console.log(`\t- ${link}`));
    }

    console.log(
      `\n🔎 Found ${totalCrossSiteBroken} broken cross-site links from docs/ markdown pointing to non-existent astro pages`
    );
  }

  if (hasBrokenLinks) {
    process.exit(1);
  }

  process.exit(0);
}
validateLinks();
