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
  generateRobotsTxt: true,
  exclude: [],
  sourceDir: buildOutputDir,
  outDir: publicOutputDir,
  robotsTxtOptions: noIndex
    ? {
        policies: [{ userAgent: '*', disallow: '/' }],
      }
    : {
        policies: [
          { userAgent: '*', allow: '/' },
          { userAgent: 'GPTBot', allow: '/' },
          { userAgent: 'ClaudeBot', allow: '/' },
          { userAgent: 'Google-Extended', allow: '/' },
          { userAgent: 'PerplexityBot', allow: '/' },
          { userAgent: 'OAI-SearchBot', allow: '/' },
          { userAgent: 'Applebot-Extended', allow: '/' },
          { userAgent: 'Meta-ExternalAgent', allow: '/' },
        ],
        // Additional sitemaps are added to the sitemap index by
        // scripts/patch-sitemap-index.mjs to avoid duplicate entries.
      },
};
