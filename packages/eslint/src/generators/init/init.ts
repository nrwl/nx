import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  readNxJson,
  removeDependenciesFromPackageJson,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import {
  eslintConfigPrettierVersion,
  eslintVersion,
  nxVersion,
  typescriptESLintVersion,
} from '../../utils/versions';

import { Linter } from '../utils/linter';
import { findEslintFile } from '../utils/eslint-file';
import { getGlobalEsLintConfiguration } from './global-eslint-config';
import { EslintPluginOptions } from '../../plugins/plugin';

export interface LinterInitOptions {
  linter?: Linter;
  unitTestRunner?: string;
  skipPackageJson?: boolean;
  rootProject?: boolean;
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
  nxJson.targetDefaults.lint ??= {};
  nxJson.targetDefaults.lint.cache ??= true;
  nxJson.targetDefaults.lint.inputs ??= [
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

function updateVSCodeExtensions(tree: Tree) {
  if (tree.exists('.vscode/extensions.json')) {
    updateJson(tree, '.vscode/extensions.json', (json) => {
      json.recommendations ||= [];
      const extension = 'dbaeumer.vscode-eslint';
      if (!json.recommendations.includes(extension)) {
        json.recommendations.push(extension);
      }
      return json;
    });
  }
}

/**
 * Initializes ESLint configuration in a workspace and adds necessary dependencies.
 */
function initEsLint(tree: Tree, options: LinterInitOptions): GeneratorCallback {
  if (findEslintFile(tree)) {
    return () => {};
  }

  if (!options.skipPackageJson) {
    removeDependenciesFromPackageJson(tree, ['@nx/eslint'], []);
  }

  writeJson(
    tree,
    '.eslintrc.json',
    getGlobalEsLintConfiguration(options.unitTestRunner, options.rootProject)
  );
  tree.write('.eslintignore', 'node_modules\n');

  updateProductionFileset(tree);

  const addPlugins = process.env.NX_PCV3 === 'true';
  if (addPlugins) {
    addPlugin(tree);
  } else {
    addTargetDefaults(tree);
  }

  updateVSCodeExtensions(tree);

  return !options.skipPackageJson
    ? addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/eslint': nxVersion,
          '@nx/eslint-plugin': nxVersion,
          '@typescript-eslint/parser': typescriptESLintVersion,
          '@typescript-eslint/eslint-plugin': typescriptESLintVersion,
          eslint: eslintVersion,
          'eslint-config-prettier': eslintConfigPrettierVersion,
        }
      )
    : () => {};
}

export function lintInitGenerator(tree: Tree, options: LinterInitOptions) {
  return initEsLint(tree, options);
}
