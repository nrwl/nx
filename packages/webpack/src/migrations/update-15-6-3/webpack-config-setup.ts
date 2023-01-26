import {
  formatFiles,
  logger,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';
import { basename } from 'path';

export default async function (tree: Tree) {
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nrwl/webpack:webpack',
    (
      options: WebpackExecutorOptions,
      projectName,
      targetName,
      _configurationName
    ) => {
      if (options?.['isolatedConfig']) {
        return;
      }

      // If webpackConfig is set, update it with the new options
      // If webpackConfig is not set, we need to create a new
      // webpack.config.js file and set the path to it in the
      // executor options

      if (options?.webpackConfig) {
        if (options.webpackConfig === '@nrwl/react/plugin/webpack') {
          return;
        }

        let oldName = options?.webpackConfig;
        if (options.webpackConfig.endsWith('.js')) {
          oldName = options.webpackConfig.replace('.js', '.old.js');
        }
        if (options.webpackConfig.endsWith('.ts')) {
          oldName = options.webpackConfig.replace('.ts', '.old.ts');
        }

        const justTheFileName = basename(options.webpackConfig);
        renameFile(tree, options.webpackConfig, oldName);

        tree.write(
          options.webpackConfig,
          `
        const { composePlugins, withNx } = require('@nrwl/webpack');

        // Nx plugins for webpack.
        module.exports = composePlugins(withNx(), (config, { options, context }) => {
          // Note: This was added by an Nx migration.
          // You should consider inlining the logic into this file.
          return require('./${justTheFileName}')(config, context);
        });
        `
        );

        options['isolatedConfig'] = true;

        const projectConfiguration = readProjectConfiguration(
          tree,
          projectName
        );
        projectConfiguration.targets[targetName].options = options;
        updateProjectConfiguration(tree, projectName, projectConfiguration);

        logger.info(
          `
          ${options.webpackConfig} has been renamed to ${oldName} and a new ${options.webpackConfig} 
          has been created for your project ${projectName}. 
          You should consider inlining the logic from ${oldName} into ${options.webpackConfig}.
          You can read our guide on how to do this here: 
          
          https://nx.dev/packages/webpack/documents/webpack-config-setup
          `
        );
      } else {
        const projectConfiguration = readProjectConfiguration(
          tree,
          projectName
        );

        if (!options) {
          options = {} as WebpackExecutorOptions;
        }

        options.webpackConfig = `${projectConfiguration.root}/webpack.config.js`;
        options['isolatedConfig'] = true;

        tree.write(
          options.webpackConfig,
          `
        const { composePlugins, withNx } = require('@nrwl/webpack');
      
        // Nx plugins for webpack.
        module.exports = composePlugins(withNx(), (config) => {
          // Update the webpack config as needed here.
          // e.g. config.plugins.push(new MyPlugin())
          return config;
        });
        `
        );

        projectConfiguration.targets[targetName].options = options;
        updateProjectConfiguration(tree, projectName, projectConfiguration);
      }
    }
  );

  await formatFiles(tree);
}

function renameFile(tree: Tree, from: string, to: string) {
  const buffer = tree.read(from);
  if (!buffer) {
    return;
  }
  tree.write(to, buffer);
  tree.delete(from);
}
