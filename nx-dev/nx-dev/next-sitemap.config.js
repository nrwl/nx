const path = require('path');

const siteUrl = process.env.NX_DEV_URL || 'https://nx.dev';
const noIndex = process.env.NEXT_PUBLIC_NO_INDEX === 'true';

const buildOutputDir = path.resolve(__dirname, '.next');
const publicOutputDir = path.resolve(__dirname, 'public');

/**
 * @type {import('next-sitemap').IConfig}
 **/
module.exports = {
  siteUrl,
  // robots.txt is served via Next.js rewrite to astro-docs (next.config.js
  // beforeFiles). Leaving this false avoids clobbering that with a static file.
  generateRobotsTxt: false,
  // /ai-chat is the root redirect target and /api/* is not indexable.
  exclude: noIndex ? ['/*'] : ['/ai-chat', '/api/*'],
  sourceDir: buildOutputDir,
  outDir: publicOutputDir,
  // Additional sitemaps are added to the sitemap index by
  // scripts/patch-sitemap-index.mjs to avoid duplicate entries.
};
