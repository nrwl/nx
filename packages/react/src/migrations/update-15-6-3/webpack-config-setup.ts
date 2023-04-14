import {
  formatFiles,
  logger,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { basename } from 'path';
import type { WebpackExecutorOptions } from '@nx/webpack';

export default async function (tree: Tree) {
  // Since projects can have multiple configurations, we need to know if the default options
  // need to be migrated or not. If so then the subsequent configurations with `webpackConfig` also need to be.
  const defaultOptionsUpdated = new Set<string>();
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nrwl/webpack:webpack',
    (options, projectName, targetName, configurationName) => {
      const projectConfiguration = readProjectConfiguration(tree, projectName);
      const defaultOptions = projectConfiguration.targets[targetName].options;
      const defaultWasUpdated = defaultOptionsUpdated.has(projectName);

      // If default was not updated (for different configurations), we don't do anything
      // If isolatedConfig is set, we don't need to do anything
      // If it is NOT React, we don't need to do anything
      if (
        !defaultWasUpdated &&
        (defaultOptions?.['isolatedConfig'] ||
          !(
            defaultOptions?.['main']?.match(/main\.(t|j)sx$/) ||
            defaultOptions?.['webpackConfig'] === '@nrwl/react/plugins/webpack'
          ))
      ) {
        return;
      }
      defaultOptionsUpdated.add(projectName);

      // If this is not the default options (e.g. for development, production, or something custom),
      // then skip it unless it specifically configures a webpackConfig file
      if (configurationName && !options?.webpackConfig) {
        return;
      }

      // If webpackConfig is set, update it with the new options
      // If webpackConfig is not set, we need to create a new
      // webpack.config.js file and set the path to it in the
      // executor options

      if (
        options?.['webpackConfig'] &&
        options['webpackConfig'] !== '@nrwl/react/plugins/webpack'
      ) {
        let oldName = options['webpackConfig'];
        if (options['webpackConfig'].endsWith('.js')) {
          oldName = options['webpackConfig'].replace('.js', '.old.js');
        }
        if (options['webpackConfig'].endsWith('.ts')) {
          oldName = options['webpackConfig'].replace('.ts', '.old.ts');
        }

        renameFile(tree, options['webpackConfig'], oldName);

        const justTheFileName = basename(oldName);
        tree.write(
          options['webpackConfig'],
          `
            const { composePlugins, withNx } = require('@nrwl/webpack');
            const { withReact } = require('@nrwl/react');

            // Nx plugins for webpack.
            module.exports = composePlugins(withNx(), withReact(), (config, { options, context }) => {
              // Note: This was added by an Nx migration.
              // You should consider inlining the logic into this file.
              // For more information on webpack config and Nx see:
              // https://nx.dev/packages/webpack/documents/webpack-config-setup
              return require('./${justTheFileName}')(config, context);
            });
            `
        );

        options['isolatedConfig'] = true;

        projectConfiguration.targets[targetName][
          configurationName ?? 'options'
        ] = options;
        updateProjectConfiguration(tree, projectName, projectConfiguration);

        logger.info(
          `
          ${options['webpackConfig']} has been renamed to ${oldName} and a new ${options['webpackConfig']} 
          has been created for your project ${projectName}. 
          You should consider inlining the logic from ${oldName} into ${options['webpackConfig']}.
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

        options[
          'webpackConfig'
        ] = `${projectConfiguration.root}/webpack.config.js`;
        options['isolatedConfig'] = true;

        tree.write(
          options['webpackConfig'],
          `
          const { composePlugins, withNx } = require('@nrwl/webpack');
          const { withReact } = require('@nrwl/react');
          
          // Nx plugins for webpack.
          module.exports = composePlugins(withNx(), withReact(), (config, { options, context }) => {
            // Update the webpack config as needed here.
            // e.g. config.plugins.push(new MyPlugin())
            // For more information on webpack config and Nx see:
            // https://nx.dev/packages/webpack/documents/webpack-config-setup
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
