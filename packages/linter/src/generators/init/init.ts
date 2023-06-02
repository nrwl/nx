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

export interface LinterInitOptions {
  linter?: Linter;
  unitTestRunner?: string;
  skipPackageJson?: boolean;
  rootProject?: boolean;
}

function addTargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    // Remove .eslintrc.json
    productionFileSet.push('!{projectRoot}/.eslintrc.json');
    // Dedupe and set
    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  nxJson.targetDefaults ??= {};

  nxJson.targetDefaults.lint ??= {};
  nxJson.targetDefaults.lint.inputs ??= [
    'default',
    `{workspaceRoot}/.eslintrc.json`,
    `{workspaceRoot}/.eslintignore`,
  ];
  updateNxJson(tree, nxJson);
}

function initEsLint(tree: Tree, options: LinterInitOptions): GeneratorCallback {
  if (findEslintFile(tree)) {
    return () => {};
  }

  if (!options.skipPackageJson) {
    removeDependenciesFromPackageJson(tree, ['@nx/linter'], []);
  }

  writeJson(
    tree,
    '.eslintrc.json',
    getGlobalEsLintConfiguration(options.unitTestRunner, options.rootProject)
  );
  tree.write('.eslintignore', 'node_modules\n');
  addTargetDefaults(tree);

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

  return !options.skipPackageJson
    ? addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/linter': nxVersion,
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
