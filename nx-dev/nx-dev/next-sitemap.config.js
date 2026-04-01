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
        additionalSitemaps: [
          `${siteUrl}/sitemap-1.xml`,
          `${siteUrl}/docs/sitemap-index.xml`,
        ],
      },
};
