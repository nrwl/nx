import {
  formatFiles,
  getProjects,
  stripIndents,
  Tree,
  joinPathFragments,
  updateProjectConfiguration,
  ProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';
import { extractWebpackOptions } from './lib/extract-webpack-options';
import { normalizePathOptions } from './lib/normalize-path-options';
import { parse } from 'path';
import { validateProject } from './lib/validate-project';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

// Make text JSON compatible
const preprocessText = (text: string) => {
  return text
    .replace(/(\w+):/g, '"$1":') // Quote property names
    .replace(/'/g, '"') // Convert single quotes to double quotes
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    .replace(/(\r\n|\n|\r|\t)/gm, ''); // Remove newlines and tabs
};

export async function convertConfigToWebpackPluginGenerator(
  tree: Tree,
  options: Schema
) {
  let migrated = 0;

  const projects = getProjects(tree);
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nx/webpack:webpack',
    (currentTargetOptions, projectName, targetName, configurationName) => {
      if (options.project && projectName !== options.project) {
        return;
      }
      if (!configurationName) {
        const project = projects.get(projectName);
        const target = project.targets[targetName];

        const hasError = validateProject(tree, project);
        if (hasError) {
          throw new Error(hasError);
        }

        const webpackConfigPath = currentTargetOptions?.webpackConfig || '';

        if (webpackConfigPath && tree.exists(webpackConfigPath)) {
          let { withNxConfig: webpackOptions, withReactConfig } =
            extractWebpackOptions(tree, webpackConfigPath);

          // if webpackOptions === undefined
          // withNx was not found in the webpack.config.js file so we should skip this project
          if (webpackOptions !== undefined) {
            let parsedOptions = {};
            if (webpackOptions) {
              parsedOptions = JSON.parse(
                preprocessText(webpackOptions.getText())
              );
              parsedOptions = normalizePathOptions(project.root, parsedOptions);
            }

            target.options.standardWebpackConfigFunction = true;

            updateProjectConfiguration(tree, projectName, project);

            const { dir, name, ext } = parse(webpackConfigPath);

            tree.rename(
              webpackConfigPath,
              `${joinPathFragments(dir, `${name}.old${ext}`)}`
            );

            tree.write(
              webpackConfigPath,
              stripIndents`
            const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
            const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
            const { useLegacyNxPlugin } = require('@nx/webpack');
            
            // This file was migrated using @nx/webpack:convert-config-to-webpack-plugin from your './webpack.config.old.js'
            // Please check that the options here are correct as they were moved from the old webpack.config.js to this file.
            const options = ${
              webpackOptions ? JSON.stringify(parsedOptions, null, 2) : '{}'
            };

            /**
              * @type{import('webpack').WebpackOptionsNormalized}
            */
            module.exports = async () => ({
              plugins: [
                ${
                  webpackOptions
                    ? 'new NxAppWebpackPlugin(options)'
                    : 'new NxAppWebpackPlugin()'
                },
                ${
                  withReactConfig
                    ? `new NxReactWebpackPlugin(${withReactConfig.getText()})`
                    : `new NxReactWebpackPlugin({
                  // Uncomment this line if you don't want to use SVGR
                  // See: https://react-svgr.com/
                  // svgr: false
                  })`
                },
                // NOTE: useLegacyNxPlugin ensures that the non-standard Webpack configuration file previously used still works.
                // To remove its usage, move options such as "plugins" into this file as standard Webpack configuration options.
                // To enhance configurations after Nx plugins have applied, you can add a new plugin with the \`apply\` method.
                // e.g. \`{ apply: (compiler) => { /* modify compiler.options */ }\`
                // eslint-disable-next-line react-hooks/rules-of-hooks
                await useLegacyNxPlugin(require('./webpack.config.old'), options),
              ],
              });
          `
            );
            migrated++;
          }
        }
      }
    }
  );
  if (migrated === 0) {
    throw new Error('Could not find any projects to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default convertConfigToWebpackPluginGenerator;
