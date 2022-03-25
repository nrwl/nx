import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments, logger } from '@nrwl/devkit';
import type { Schema } from '../schema';

export function generateWebpackConfig(
  host: Tree,
  options: Schema,
  appRoot: string,
  remotesWithPorts: { remoteName: string; port: number }[]
) {
  if (
    host.exists(`${appRoot}/mfe.config.js`) ||
    host.exists(`${appRoot}/webpack.config.js`) ||
    host.exists(`${appRoot}/webpack.prod.config.js`)
  ) {
    logger.warn(
      `NOTE: We encountered an existing webpack config for the app ${options.appName}. We have overwritten this file with the Module Federation Config.\n
      If this was not the outcome you expected, you can discard the changes we have made, create a backup of your current webpack config, and run the command again.`
    );
  }

  generateFiles(
    host,
    joinPathFragments(__dirname, '../files/webpack'),
    appRoot,
    {
      tmpl: '',
      type: options.mfeType,
      name: options.appName,
      remotes: remotesWithPorts ?? [],
      projectRoot: appRoot,
    }
  );
}
