import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments, logger } from '@nx/devkit';
import type { Schema } from '../schema';

export function generateWebpackConfig(
  tree: Tree,
  options: Schema,
  appRoot: string,
  remotesWithPorts: { remoteName: string; port: number }[]
) {
  if (
    tree.exists(`${appRoot}/module-federation.config.js`) ||
    tree.exists(`${appRoot}/webpack.config.js`) ||
    tree.exists(`${appRoot}/webpack.prod.config.js`) ||
    tree.exists(`${appRoot}/module-federation.config.ts`) ||
    tree.exists(`${appRoot}/webpack.config.ts`) ||
    tree.exists(`${appRoot}/webpack.prod.config.ts`)
  ) {
    logger.warn(
      `NOTE: We encountered an existing webpack config for the app ${options.appName}. We have overwritten this file with the Module Federation Config.\n
      If this was not the outcome you expected, you can discard the changes we have made, create a backup of your current webpack config, and run the command again.`
    );
  }

  const pathToWebpackTemplateFiles = options.typescriptConfiguration
    ? 'ts-webpack'
    : 'webpack';

  generateFiles(
    tree,
    joinPathFragments(__dirname, `../files/${pathToWebpackTemplateFiles}`),
    appRoot,
    {
      tmpl: '',
      type: options.mfType,
      federationType: options.federationType,
      name: options.appName,
      remotes: remotesWithPorts ?? [],
      projectRoot: appRoot,
      standalone: options.standalone,
    }
  );

  if (!options.setParserOptionsProject) {
    tree.delete(joinPathFragments(appRoot, 'tsconfig.lint.json'));
  }
}
