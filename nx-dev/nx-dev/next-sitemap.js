const path = require('path');

module.exports = {
  siteUrl: process.env.SITE_URL || 'https://nx.dev',
  generateRobotsTxt: true,
  exclude: ['/preview/*'],
  sourceDir: path.resolve(__dirname, '../../dist/nx-dev/nx-dev/.next'),
  outDir: path.resolve(__dirname, '../../dist/nx-dev/nx-dev/public'),
};
