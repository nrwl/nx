import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import baseConfig from '../../eslint.config.mjs';
import jsoncEslintParser from 'jsonc-eslint-parser';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: 'fast-glob',
          message: 'Please use `tinyglobby` instead.',
        },
        {
          name: 'minimatch',
          message: 'Please use `picomatch` instead.',
        },
        {
          name: 'fs-extra',
          message: 'Please use equivalent utilities from `node:fs` instead.',
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: [
      './package.json',
      './generators.json',
      './executors.json',
      './migrations.json',
    ],
    rules: {
      '@nx/nx-plugin-checks': 'error',
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    files: ['./package.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          buildTargets: ['build-base'],
          ignoredDependencies: [
            'nx',
            'prettier',
            'typescript',
            'eslint',
            'verdaccio',
            'source-map-support',
            '@babel/core',
            '@babel/plugin-proposal-decorators',
            '@babel/plugin-transform-class-properties',
            '@babel/plugin-transform-runtime',
            '@babel/preset-env',
            '@babel/preset-typescript',
            '@babel/runtime',
            '@swc/cli',
            'babel-plugin-const-enum',
            'babel-plugin-macros',
            'babel-plugin-transform-typescript-metadata',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
