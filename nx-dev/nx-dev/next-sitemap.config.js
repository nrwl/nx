const path = require('path');

const siteUrl = process.env.SITE_URL || 'https://nx.dev';
/**
 * @type {import('next-sitemap').IConfig}
 **/
module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  exclude: [],
  sourceDir: path.resolve(__dirname, '../../dist/nx-dev/nx-dev/.next'),
  outDir: path.resolve(__dirname, '../../dist/nx-dev/nx-dev/public'),
  robotsTxtOptions: {
    additionalSitemaps: [`${siteUrl}/docs/sitemap-index.xml`],
  },
};
