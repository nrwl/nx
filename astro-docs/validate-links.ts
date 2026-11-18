import fs from 'node:fs';
import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import {
  assertDocsBuilt,
  distDir,
  loadAllSitemapRoutes,
} from './link-validation/sitemap-routes';

// Links to pages hosted outside of both astro-docs and nx-dev sites
const ignoredLinks = ['/contact', '/blog'];

// These are more so until we cut over and can modify production file links
const filesToIgnore = [
  '/executors/index.html',
  '/generators/index.html',
  '/migrations/index.html',
  '/nx-commands/index.html',
];

assertDocsBuilt();

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

function toFriendlyName(file: string) {
  // TODO: resolve to the actual markdown file if possile?
  return path.relative(workspaceRoot, file);
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

  if (hasBrokenLinks) {
    process.exit(1);
  }

  process.exit(0);
}
validateLinks();
