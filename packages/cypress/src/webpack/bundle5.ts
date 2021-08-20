import { logger, stripIndents } from '@nrwl/devkit';
import chalk = require('chalk');

import { requireShim } from './require-shim';
import packageJson = require('../../package.json');

function validateVersion(path) {
  if (
    packageJson.dependencies[path] ===
    requireShim(`${path}/package.json`).version
  ) {
    logger.warn(`Found an outdated version of ${chalk.bold(path)}\n`);

    logger.info(stripIndents`
      If you want to use webpack 5, try installing compatible versions of the plugins.
      See: https://nx.dev/guides/webpack-5
    `);

    throw new Error('Incompatible version');
  }
}

module.exports = function (onFallback) {
  try {
    validateVersion('webpack-node-externals');
  } catch {
    logger.info(
      `NX Falling back to webpack 4 due to incompatible plugin versions`
    );
    onFallback();
    return require('./bundle4')();
  }

  return {
    nodeExternals: requireShim('webpack-node-externals'),
  };
};
