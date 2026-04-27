import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
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
            'eslint',
            'prettier',
            'typescript',
            'react',
            'react-native',
            '@nx/jest',
            '@nx/rollup',
            '@nx/storybook',
            '@nx/vite',
            '@nx/webpack',
            '@nx/detox',
            '@nx/cypress',
            '@nx/playwright',
            'ajv',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        '@nx/workspace',
        {
          name: 'fs-extra',
          message: 'Please use equivalent utilities from `node:fs` instead.',
        },
        {
          name: 'chalk',
          message:
            'Please use `picocolors` in place of `chalk` for rendering terminal colors',
        },
      ],
    },
  },
];
