import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  readWorkspaceConfiguration,
  removeDependenciesFromPackageJson,
  updateJson,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import {
  eslintConfigPrettierVersion,
  eslintVersion,
  nxVersion,
  typescriptESLintVersion,
} from '../../utils/versions';

import { Linter } from '../utils/linter';
import { findEslintFile } from '../utils/eslint-file';
import { ESLint } from 'eslint';

export interface LinterInitOptions {
  linter?: Linter;
  unitTestRunner?: string;
  skipPackageJson?: boolean;
}

const getGlobalEsLintConfiguration = (unitTestRunner?: string) => {
  const config: ESLint.ConfigData = {
    root: true,
    ignorePatterns: ['**/*'],
    plugins: ['@nrwl/nx'],
    /**
     * We leverage ESLint's "overrides" capability so that we can set up a root config which will support
     * all permutations of Nx workspaces across all frameworks, libraries and tools.
     *
     * The key point is that we need entirely different ESLint config to apply to different types of files,
     * but we still want to share common config where possible.
     */
    overrides: [
      /**
       * This configuration is intended to apply to all "source code" (but not
       * markup like HTML, or other custom file types like GraphQL)
       */
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        rules: {
          '@nrwl/nx/enforce-module-boundaries': [
            'error',
            {
              enforceBuildableLibDependency: true,
              allow: [],
              depConstraints: [
                { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
              ],
            },
          ],
        },
      },

      /**
       * This configuration is intended to apply to all TypeScript source files.
       * See the eslint-plugin-nx package for what is in the referenced shareable config.
       */
      {
        files: ['*.ts', '*.tsx'],
        extends: ['plugin:@nrwl/nx/typescript'],
        /**
         * Having an empty rules object present makes it more obvious to the user where they would
         * extend things from if they needed to
         */
        rules: {},
      },

      /**
       * This configuration is intended to apply to all JavaScript source files.
       * See the eslint-plugin-nx package for what is in the referenced shareable config.
       */
      {
        files: ['*.js', '*.jsx'],
        extends: ['plugin:@nrwl/nx/javascript'],
        /**
         * Having an empty rules object present makes it more obvious to the user where they would
         * extend things from if they needed to
         */
        rules: {},
      },
    ],
  };
  if (unitTestRunner === 'jest') {
    config.overrides.push({
      files: ['*.spec.ts', '*.spec.tsx', '*.spec.js', '*.spec.jsx'],
      env: {
        jest: true,
      },
      rules: {},
    });
  }
  return config;
};

function addTargetDefaults(tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const productionFileSet = workspaceConfiguration.namedInputs?.production;
  if (productionFileSet) {
    // Remove .eslintrc.json
    productionFileSet.push('!{projectRoot}/.eslintrc.json');
    // Dedupe and set
    workspaceConfiguration.namedInputs.production = Array.from(
      new Set(productionFileSet)
    );
  }

  workspaceConfiguration.targetDefaults ??= {};

  workspaceConfiguration.targetDefaults.lint ??= {};
  workspaceConfiguration.targetDefaults.lint.inputs ??= [
    'default',
    `{workspaceRoot}/.eslintrc.json`,
  ];
  updateWorkspaceConfiguration(tree, workspaceConfiguration);
}

function initEsLint(tree: Tree, options: LinterInitOptions): GeneratorCallback {
  if (findEslintFile(tree)) {
    return () => {};
  }

  if (!options.skipPackageJson) {
    removeDependenciesFromPackageJson(tree, ['@nrwl/linter'], []);
  }

  writeJson(
    tree,
    '.eslintrc.json',
    getGlobalEsLintConfiguration(options.unitTestRunner)
  );
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
          '@nrwl/linter': nxVersion,
          '@nrwl/eslint-plugin-nx': nxVersion,
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
