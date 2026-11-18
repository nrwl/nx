import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import {
  loadRedirectRules,
  normalizePath,
  resolvePath,
} from './link-validation/redirects';
import {
  assertDocsBuilt,
  loadAllSitemapRoutes,
} from './link-validation/sitemap-routes';

// Pages served on nx.dev from outside both astro-docs and nx-dev
const ignoredPaths = ['/', '/blog', '/community', '/contact', '/nx-cloud'];

const sourceFilePattern = /\.(ts|md)(__tpl__|__tmpl__|\.template)?$/;
const excludedFilePattern = /\.spec\.ts$|\/__snapshots__\//;

// Stops at quotes, brackets, whitespace and backslashes so links embedded in
// string literals (`...\n`), markdown (`[x](url)`) and JSX end cleanly.
const nxDevUrlPattern =
  /https?:\/\/(?:www\.)?nx\.dev(?![\w-]|\.\w)([^\s"'`<>()[\]{}\\|^$]*)/g;

interface FoundLink {
  file: string;
  line: number;
  url: string;
  pathname: string;
}

function listSourceFiles(): string[] {
  return execFileSync('git', ['ls-files', '--', 'packages'], {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
    .split('\n')
    .filter(
      (file) => sourceFilePattern.test(file) && !excludedFilePattern.test(file)
    );
}

function extractNxDevLinks(file: string, content: string): FoundLink[] {
  const links: FoundLink[] = [];
  const lines = content.split('\n');
  lines.forEach((text, index) => {
    for (const match of text.matchAll(nxDevUrlPattern)) {
      const following = text.slice(match.index + match[0].length);
      // Interpolated URLs are built at runtime and can't be checked statically.
      if (following.startsWith('${') || following.startsWith('<%')) {
        continue;
      }
      const url = match[0].replace(/[.,;:!?*_]+$/, '');
      links.push({
        file,
        line: index + 1,
        url,
        pathname: new URL(url).pathname,
      });
    }
  });
  return links;
}

function validatePackageLinks() {
  assertDocsBuilt();

  console.log('🔍 Validating nx.dev links in packages/...\n');

  const links: FoundLink[] = [];
  const files = listSourceFiles();
  for (const file of files) {
    const content = fs.readFileSync(path.join(workspaceRoot, file), 'utf-8');
    if (content.includes('nx.dev')) {
      links.push(...extractNxDevLinks(file, content));
    }
  }
  console.log(`Found ${links.length} nx.dev links in ${files.length} files\n`);

  const routes = new Set([...loadAllSitemapRoutes()].map(normalizePath));
  const rules = loadRedirectRules();
  console.log(
    `Loaded ${routes.size} sitemap routes and ${rules.length} redirect rules\n`
  );

  let redirected = 0;
  const broken: FoundLink[] = [];
  for (const link of links) {
    if (ignoredPaths.includes(normalizePath(link.pathname))) {
      continue;
    }
    const resolution = resolvePath(link.pathname, routes, rules);
    if (!resolution.ok) {
      broken.push(link);
    } else if (resolution.hops > 0) {
      redirected++;
    }
  }

  if (redirected > 0) {
    console.log(`ℹ️  ${redirected} links resolve only through redirects\n`);
  }

  if (broken.length === 0) {
    console.log('✅ All nx.dev links in packages/ resolve to a docs page');
    process.exit(0);
  }

  console.log(`❌ Found ${broken.length} broken nx.dev links:\n`);
  for (const link of broken) {
    console.log(`  ${link.file}:${link.line}\n\t- ${link.url}`);
  }
  console.log(
    '\n🔎 Point each link at a page in the docs sitemap, or add a redirect for the old path in astro-docs/netlify.toml.'
  );
  process.exit(1);
}

validatePackageLinks();
