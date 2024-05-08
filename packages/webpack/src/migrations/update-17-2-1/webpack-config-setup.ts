import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';

export default async function (tree: Tree) {
  const update = (
    options: WebpackExecutorOptions,
    projectName: string,
    targetName: string,
    configurationName: string
  ) => {
    // Only handle webpack config for default configuration
    if (configurationName) return;

    const projectConfiguration = readProjectConfiguration(tree, projectName);

    if (!options.webpackConfig && options.isolatedConfig !== false) {
      options.webpackConfig = `${projectConfiguration.root}/webpack.config.js`;
      tree.write(
        options.webpackConfig,
        `
        const { composePlugins, withNx } = require('@nx/webpack');

        // Nx plugins for webpack.
        module.exports = composePlugins(withNx(), (config) => {
          // Note: This was added by an Nx migration. Webpack builds are required to have a corresponding Webpack config file.
          // See: https://nx.dev/recipes/webpack/webpack-config-setup
          return config;
        });
        `
      );

      projectConfiguration.targets[targetName].options = options;
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  };

  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nx/webpack:webpack',
    update
  );
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nrwl/webpack:webpack',
    update
  );

  await formatFiles(tree);
}
