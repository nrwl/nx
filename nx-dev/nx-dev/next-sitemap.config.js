const path = require('path');

const siteUrl = process.env.NX_DEV_URL || 'https://nx.dev';
const noIndex = process.env.NEXT_PUBLIC_NO_INDEX === 'true';

// On Netlify, the build output is in nx-dev/nx-dev/.next instead of dist/nx-dev/nx-dev/.next
const isNetlify = process.env.NETLIFY === 'true';
const buildOutputDir = isNetlify
  ? path.resolve(__dirname, '.next')
  : path.resolve(__dirname, '../../dist/nx-dev/nx-dev/.next');
const publicOutputDir = isNetlify
  ? path.resolve(__dirname, 'public')
  : path.resolve(__dirname, '../../dist/nx-dev/nx-dev/public');

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
        additionalSitemaps: [`${siteUrl}/docs/sitemap-index.xml`],
      },
};
