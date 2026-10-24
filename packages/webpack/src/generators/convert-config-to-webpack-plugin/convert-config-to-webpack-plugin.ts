import { forEachExecutorOptions } from '@nx/devkit/internal';
import {
  formatFiles,
  getProjects,
  stripIndents,
  Tree,
  joinPathFragments,
  updateProjectConfiguration,
  ProjectConfiguration,
} from '@nx/devkit';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';
import { extractWebpackOptions } from './lib/extract-webpack-options';
import { normalizePathOptions } from './lib/normalize-path-options';
import { parse } from 'path';
import { validateProject } from './lib/validate-project';
import { assertSupportedWebpackVersion } from '../../utils/versions';

const buildExecutors = ['@nx/webpack:webpack', '@nrwl/webpack:webpack'];

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
  assertSupportedWebpackVersion(tree);

  let migrated = 0;

  const projects = getProjects(tree);
  for (const executor of buildExecutors) {
    forEachExecutorOptions<WebpackExecutorOptions>(
      tree,
      executor,
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

          if (
            webpackConfigPath &&
            tree.exists(webpackConfigPath) &&
            convertConfigFile(tree, project.root, webpackConfigPath)
          ) {
            target.options.standardWebpackConfigFunction = true;
            updateProjectConfiguration(tree, projectName, project);
            migrated++;
          }
        }
      }
    );
  }

  // Projects already on the inference plugin keep their options in the config,
  // so only the config needs converting.
  for (const [projectName, project] of projects) {
    if (options.project && projectName !== options.project) {
      continue;
    }
    if (
      Object.values(project.targets ?? {}).some((target) =>
        buildExecutors.includes(target.executor)
      )
    ) {
      continue;
    }
    const webpackConfigPath = joinPathFragments(
      project.root,
      'webpack.config.js'
    );
    if (
      tree.exists(webpackConfigPath) &&
      convertConfigFile(tree, project.root, webpackConfigPath)
    ) {
      migrated++;
    }
  }
  if (migrated === 0) {
    throw new Error('Could not find any projects to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

/** Returns whether the config used `withNx` and was converted. */
function convertConfigFile(
  tree: Tree,
  projectRoot: string,
  webpackConfigPath: string
): boolean {
  let {
    withNxConfig: webpackOptions,
    withReactConfig,
    strippedSource,
    leftoverHelpers,
  } = extractWebpackOptions(tree, webpackConfigPath);

  // if webpackOptions === undefined
  // withNx was not found in the webpack.config.js file so we should skip this project
  if (webpackOptions !== undefined) {
    // The `.old` config would call helpers whose imports were removed, or inert stubs.
    if (leftoverHelpers.length) {
      throw new Error(
        `Could not convert ${webpackConfigPath}: ${leftoverHelpers.join(', ')} would be left in the old config. Only \`require\`d helpers passed directly to \`composePlugins\` are supported.`
      );
    }
    let parsedOptions = {};
    if (webpackOptions) {
      // Parse before writing anything: a non-literal option value leaves the
      // project untouched for the migration prompt instead of a config whose
      // helper calls are gone and whose options never made it across.
      try {
        parsedOptions = JSON.parse(preprocessText(webpackOptions.getText()));
      } catch {
        throw new Error(
          `Could not read the \`withNx\` options in ${webpackConfigPath}. They must be a plain object literal; spreads, variables and function calls are not supported.`
        );
      }
      parsedOptions = normalizePathOptions(projectRoot, parsedOptions);
    }

    if (strippedSource !== undefined) {
      tree.write(webpackConfigPath, strippedSource);
    }

    const { dir, name, ext } = parse(webpackConfigPath);

    tree.rename(
      webpackConfigPath,
      `${joinPathFragments(dir, `${name}.old${ext}`)}`
    );

    // `@nx/webpack` does not depend on `@nx/react`, so only React configs may require it.
    const usesReact = withReactConfig !== undefined;
    const reactRequire = usesReact
      ? `\nconst { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');`
      : '';
    const reactPlugin = usesReact
      ? `\nnew NxReactWebpackPlugin(${withReactConfig ? withReactConfig.getText() : ''}),`
      : '';

    tree.write(
      webpackConfigPath,
      stripIndents`
    const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');${reactRequire}
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
        },${reactPlugin}
        // NOTE: useLegacyNxPlugin ensures that the non-standard Webpack configuration file previously used still works.
        // To remove its usage, move options such as "plugins" into this file as standard Webpack configuration options.
        // To enhance configurations after Nx plugins have applied, you can add a new plugin with the \`apply\` method.
        // e.g. \`{ apply: (compiler) => { /* modify compiler.options */ }\`
        // eslint-disable-next-line react-hooks/rules-of-hooks
        await useLegacyNxPlugin(require('./webpack.config.old${ext}'), options),
      ],
      });
  `
    );
    return true;
  }
  return false;
}

export default convertConfigToWebpackPluginGenerator;
