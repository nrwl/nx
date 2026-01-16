const path = require('path');

const siteUrl = process.env.NX_DEV_URL || 'https://nx.dev';
const noIndex = process.env.NEXT_PUBLIC_NO_INDEX === 'true';

/**
 * @type {import('next-sitemap').IConfig}
 **/
module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  exclude: [],
  sourceDir: path.resolve(__dirname, '../../dist/nx-dev/nx-dev/.next'),
  outDir: path.resolve(__dirname, '../../dist/nx-dev/nx-dev/public'),
  robotsTxtOptions: noIndex
    ? {
        policies: [{ userAgent: '*', disallow: '/' }],
      }
    : {
        additionalSitemaps: [`${siteUrl}/docs/sitemap-index.xml`],
      },
};
