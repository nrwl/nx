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
import { RspackExecutorSchema } from '../../executors/rspack/schema';
import { extractRspackOptions } from './lib/extract-rspack-options';
import { normalizePathOptions } from './lib/normalize-path-options';
import { parse } from 'path';
import { validateProject } from './lib/validate-project';
import { assertSupportedRspackVersion } from '../../utils/assert-supported-rspack-version';

const buildExecutors = ['@nx/rspack:rspack', '@nrwl/rspack:rspack'];

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
  assertSupportedRspackVersion(tree);

  let migrated = 0;

  const projects = getProjects(tree);
  for (const executor of buildExecutors) {
    forEachExecutorOptions<RspackExecutorSchema>(
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

          const rspackConfigPath = currentTargetOptions?.rspackConfig || '';

          if (
            rspackConfigPath &&
            tree.exists(rspackConfigPath) &&
            convertConfigFile(tree, project.root, rspackConfigPath)
          ) {
            target.options.standardRspackConfigFunction = true;
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
    const rspackConfigPath = joinPathFragments(
      project.root,
      'rspack.config.js'
    );
    if (
      tree.exists(rspackConfigPath) &&
      convertConfigFile(tree, project.root, rspackConfigPath)
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
  rspackConfigPath: string
): boolean {
  let {
    withNxConfig: rspackOptions,
    withReactConfig,
    strippedSource,
    leftoverHelpers,
  } = extractRspackOptions(tree, rspackConfigPath);

  // if rspackOptions === undefined
  // withNx was not found in the rspack.config.js file so we should skip this project
  if (rspackOptions !== undefined) {
    // The `.old` config would call helpers whose imports were removed, or inert stubs.
    if (leftoverHelpers.length) {
      throw new Error(
        `Could not convert ${rspackConfigPath}: ${leftoverHelpers.join(', ')} would be left in the old config. Only \`require\`d helpers passed directly to \`composePlugins\` are supported.`
      );
    }
    let parsedOptions = {};
    if (rspackOptions) {
      // Parse before writing anything: a non-literal option value leaves the
      // project untouched for the migration prompt instead of a config whose
      // helper calls are gone and whose options never made it across.
      try {
        parsedOptions = JSON.parse(preprocessText(rspackOptions.getText()));
      } catch {
        throw new Error(
          `Could not read the \`withNx\` options in ${rspackConfigPath}. They must be a plain object literal; spreads, variables and function calls are not supported.`
        );
      }
      parsedOptions = normalizePathOptions(projectRoot, parsedOptions);
    }

    if (strippedSource !== undefined) {
      tree.write(rspackConfigPath, strippedSource);
    }

    const { dir, name, ext } = parse(rspackConfigPath);

    tree.rename(
      rspackConfigPath,
      `${joinPathFragments(dir, `${name}.old${ext}`)}`
    );

    const usesReact = withReactConfig !== undefined;
    const reactRequire = usesReact
      ? `\nconst { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');`
      : '';
    const reactPlugin = usesReact
      ? `\nnew NxReactRspackPlugin(${withReactConfig ? withReactConfig.getText() : ''}),`
      : '';

    tree.write(
      rspackConfigPath,
      stripIndents`
    const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');${reactRequire}
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
        },${reactPlugin}
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
    return true;
  }
  return false;
}

export default convertConfigToRspackPluginGenerator;
