const path = require('path');

module.exports = {
  siteUrl: process.env.SITE_URL || 'https://nx.dev',
  generateRobotsTxt: true,
  exclude: [],
  sourceDir: path.resolve(__dirname, '.next'),
  outDir: path.resolve(__dirname, 'public'),
};
