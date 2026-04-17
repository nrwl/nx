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
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: 'chalk',
          message:
            'Please use `picocolors` in place of `chalk` for rendering terminal colors',
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        '@nx/workspace',
        '@angular-devkit/core',
        '@angular-devkit/schematics',
        '@angular-devkit/architect',
      ],
    },
    ignores: ['./src/migrations/**'],
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
            'typescript',
            'eslint',
            'http-server',
            '@nx/eslint',
            '@nx/cypress',
            '@nx/playwright',
            '@nx/vite',
            '@nx/vitest',
            '@nx/webpack',
            '@nx/jest',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
