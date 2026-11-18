import fs from 'node:fs';
import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';

export const distDir = path.join(workspaceRoot, 'astro-docs', 'dist');
const sitemapIndexPath = path.join(distDir, 'sitemap-index.xml');
const sitemapFallbackPath = path.join(distDir, 'sitemap-0.xml');
const nxDevSitemapPath = path.join(
  workspaceRoot,
  'nx-dev',
  'nx-dev',
  'public',
  'sitemap-0.xml'
);

export function assertDocsBuilt() {
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
export function loadAllSitemapRoutes(): Set<string> {
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
