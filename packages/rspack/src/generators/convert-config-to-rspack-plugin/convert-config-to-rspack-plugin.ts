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
import { RspackExecutorSchema } from '../../executors/rspack/schema';
import { extractRspackOptions } from './lib/extract-rspack-options';
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

export async function convertConfigToRspackPluginGenerator(
  tree: Tree,
  options: Schema
) {
  let migrated = 0;

  const projects = getProjects(tree);
  forEachExecutorOptions<RspackExecutorSchema>(
    tree,
    '@nx/rspack:rspack',
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

        const rspackConfigPath = currentTargetOptions?.rspackConfig || '';

        if (rspackConfigPath && tree.exists(rspackConfigPath)) {
          let { withNxConfig: rspackOptions, withReactConfig } =
            extractRspackOptions(tree, rspackConfigPath);

          // if rspackOptions === undefined
          // withNx was not found in the rspack.config.js file so we should skip this project
          if (rspackOptions !== undefined) {
            let parsedOptions = {};
            if (rspackOptions) {
              parsedOptions = JSON.parse(
                preprocessText(rspackOptions.getText())
              );
              parsedOptions = normalizePathOptions(project.root, parsedOptions);
            }

            target.options.standardRspackConfigFunction = true;

            updateProjectConfiguration(tree, projectName, project);

            const { dir, name, ext } = parse(rspackConfigPath);

            tree.rename(
              rspackConfigPath,
              `${joinPathFragments(dir, `${name}.old${ext}`)}`
            );

            tree.write(
              rspackConfigPath,
              stripIndents`
            const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
            const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
            const { useLegacyNxPlugin } = require('@nx/rspack');
            
            // This file was migrated using @nx/rspack:convert-config-to-rspack-plugin from your './rspack.config.old.js'
            // Please check that the options here are correct as they were moved from the old rspack.config.js to this file.
            const options = ${
              rspackOptions ? JSON.stringify(parsedOptions, null, 2) : '{}'
            };

            /**
              * @type{import('@rspack/core').RspackOptionsNormalized}
            */
            module.exports = async () => ({
              plugins: [
                ${
                  rspackOptions
                    ? 'new NxAppRspackPlugin(options)'
                    : 'new NxAppRspackPlugin()'
                },
                ${
                  withReactConfig
                    ? `new NxReactRspackPlugin(${withReactConfig.getText()})`
                    : `new NxReactRspackPlugin({
                  // Uncomment this line if you don't want to use SVGR
                  // See: https://react-svgr.com/
                  // svgr: false
                  })`
                },
                // NOTE: useLegacyNxPlugin ensures that the non-standard Rspack configuration file previously used still works.
                // To remove its usage, move options such as "plugins" into this file as standard Rspack configuration options.
                // To enhance configurations after Nx plugins have applied, you can add a new plugin with the \`apply\` method.
                // e.g. \`{ apply: (compiler) => { /* modify compiler.options */ }\`
                // eslint-disable-next-line react-hooks/rules-of-hooks
                await useLegacyNxPlugin(require('./rspack.config.old'), options),
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

export default convertConfigToRspackPluginGenerator;
