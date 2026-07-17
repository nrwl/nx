import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    ignores: ['dist'],
  },
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
            // Self-reference used only to resolve the package's own
            // package.json at runtime (see src/utils/versions.ts).
            '@nx/js',
            // Install-graph dep only: keeps @nx/workspace resolvable in
            // created workspaces so `nx g @nx/workspace:preset` works.
            // No code-level import in @nx/js.
            '@nx/workspace',
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
