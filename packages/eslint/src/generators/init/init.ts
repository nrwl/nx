import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  updateNxJson,
} from '@nx/devkit';
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';
import { eslintVersion, nxVersion } from '../../utils/versions';
import { findEslintFile } from '../utils/eslint-file';
import { EslintPluginOptions, createNodes } from '../../plugins/plugin';
import { hasEslintPlugin } from '../utils/plugin';

export interface LinterInitOptions {
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
}

function updateProductionFileset(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push('!{projectRoot}/.eslintrc.json');
    productionFileSet.push('!{projectRoot}/eslint.config.js');
    // Dedupe and set
    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }
  updateNxJson(tree, nxJson);
}

function addTargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults['@nx/eslint:lint'] ??= {};
  nxJson.targetDefaults['@nx/eslint:lint'].cache ??= true;
  nxJson.targetDefaults['@nx/eslint:lint'].inputs ??= [
    'default',
    `{workspaceRoot}/.eslintrc.json`,
    `{workspaceRoot}/.eslintignore`,
    `{workspaceRoot}/eslint.config.js`,
  ];
  updateNxJson(tree, nxJson);
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/eslint/plugin'
        : plugin.plugin === '@nx/eslint/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/eslint/plugin',
    options: {
      targetName: 'lint',
    } as EslintPluginOptions,
  });
  updateNxJson(tree, nxJson);
}

async function initEsLint(
  tree: Tree,
  options: LinterInitOptions
): Promise<GeneratorCallback> {
  const addPlugins = process.env.NX_PCV3 === 'true';
  const hasPlugin = hasEslintPlugin(tree);
  const rootEslintFile = findEslintFile(tree);

  if (rootEslintFile && addPlugins && !hasPlugin) {
    addPlugin(tree);

    if (options.updatePackageScripts) {
      await updatePackageScripts(tree, createNodes);
    }

    return () => {};
  }

  if (rootEslintFile) {
    return () => {};
  }

  updateProductionFileset(tree);

  if (addPlugins) {
    addPlugin(tree);
  } else {
    addTargetDefaults(tree);
  }

  const tasks: GeneratorCallback[] = [];
  if (!options.skipPackageJson) {
    tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/eslint'], []));
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/eslint': nxVersion,
          eslint: eslintVersion,
        },
        undefined,
        options.keepExistingVersions
      )
    );
  }

  if (options.updatePackageScripts) {
    await updatePackageScripts(tree, createNodes);
  }

  return runTasksInSerial(...tasks);
}

export async function lintInitGenerator(
  tree: Tree,
  options: LinterInitOptions
) {
  return await initEsLint(tree, options);
}
