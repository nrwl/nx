import {
  addDependenciesToPackageJson,
  formatFiles,
  logger,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { lt } from 'semver';
import { join } from 'path';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import type { StorybookExecutorOptions } from '@nrwl/storybook/src/executors/storybook/storybook.impl';

export default async function (tree: Tree) {
  let storybookVersion;
  try {
    storybookVersion = require('@storybook/core/package.json').version;
  } catch {}

  if (!storybookVersion) {
    return;
  }

  if (lt(storybookVersion, '6.2.0')) {
    logger.error(stripIndents`NX Could not migrate to Angular 12
      Angular 12 uses Webpack 5.
      This workspace uses Storybook ${storybookVersion} which does not support Webpack 5.
      Storybook 6.2+ is required to support Webpack 5.
      See our documentation on migrating to Storybook 6:
      https://nx.dev/storybook/overview-angular#upgrading-to-storybook-6-using-the-nx-migration-generator
    `);
    throw new Error('Could not migrate to Angular 12');
  }

  let updated;
  forEachExecutorOptions<StorybookExecutorOptions>(
    tree,
    '@nrwl/storybook:storybook',
    (options) => {
      if (options.uiFramework !== '@storybook/angular') {
        return;
      }

      const configFolder = options?.config?.configFolder;

      if (!configFolder) {
        return;
      }

      const configPath = join(configFolder, 'main.js');

      if (!tree.exists(configPath)) {
        logger.warn(
          `Could not migrate ${configPath} to use webpack 5. The config.core.builder should be set to "webpack5". See https://gist.github.com/shilman/8856ea1786dcd247139b47b270912324#upgrade`
        );
        return;
      }

      updated = true;
      const originalContents = tree.read(configPath).toString();
      const configureWebpack5 = `module.exports.core = { ...module.exports.core, builder: 'webpack5' };`;
      try {
        const config = require(join(tree.root, configPath));
        if (config?.core?.builder !== 'webpack5') {
          tree.write(configPath, originalContents + '\n' + configureWebpack5);
        }
      } catch {}
    }
  );

  const installTask = updated
    ? addDependenciesToPackageJson(
        tree,
        {},
        {
          '@storybook/builder-webpack5': storybookVersion,
        }
      )
    : () => {};
  await formatFiles(tree);

  return installTask;
}
