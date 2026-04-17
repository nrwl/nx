import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import typescriptEslintParser from '@typescript-eslint/parser';
import globals from 'globals';
import jsoncEslintParser from 'jsonc-eslint-parser';
import toolsEslintRulesRawFileParserJs from './tools/eslint-rules/raw-file-parser.js';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  ...compat.extends('plugin:storybook/recommended'),
  ...nx.configs['flat/base'],
  { plugins: { '@typescript-eslint': typescriptEslintEslintPlugin } },
  {
    languageOptions: {
      parser: typescriptEslintParser,
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'create-nx-workspace',
              message: 'Please import utils from nx or @nx/devkit instead.',
            },
            {
              name: 'node-fetch',
              message:
                "Please default to native fetch instead of 'node-fetch'.",
            },
          ],
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['nx/src/plugins/js*'],
              message:
                "Imports from 'nx/src/plugins/js' are not allowed. Use '@nx/js' instead",
            },
            {
              group: ['**/native-bindings', '**/native-bindings.js', ''],
              message:
                'Direct imports from native-bindings.js are not allowed. Import from index.js instead.',
            },
          ],
        },
      ],
      'storybook/no-uninstalled-addons': [
        'error',
        {
          ignore: ['@nx/react/plugins/storybook'],
          packageJsonLocation: '../../package.json',
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    // Override or add rules here
    rules: {},
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    files: ['**/executors/**/schema.json', '**/generators/**/schema.json'],
    rules: {
      '@nx/workspace-valid-schema-description': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          checkDynamicDependenciesExceptions: ['.*'],
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      '@nx/workspace-valid-command-object': 'error',
      '@nx/workspace-require-windows-hide': 'error',
    },
  },
  {
    files: ['pnpm-lock.yaml'],
    rules: {
      '@nx/workspace-ensure-pnpm-lock-version': [
        'error',
        {
          version: '9.0',
        },
      ],
    },
    languageOptions: {
      parser: toolsEslintRulesRawFileParserJs,
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/prefer-standalone': 'off',
    },
  },
  ...compat
    .config({
      plugins: ['jest'],
    })
    .map((config) => ({
      ...config,
      files: [
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.spec.js',
        '**/*.spec.jsx',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.test.js',
        '**/*.test.jsx',
      ],
      rules: {
        ...config.rules,
        'jest/no-disabled-tests': 'warn',
      },
    })),
  {
    ignores: ['**/*.ts', '**/test-output', '**/dist'],
  },
];
