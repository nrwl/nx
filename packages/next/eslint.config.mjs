import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
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
        {
          name: 'fs-extra',
          message:
            'Please use native functionality in place of `fs-extra` for file-system interaction',
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
    files: ['./plugins/with-nx.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            '@nx/workspace',
            '@angular-devkit/core',
            '@angular-devkit/architect',
            '@angular-devkit/schematics',
          ],
          patterns: [
            {
              group: ['**/src/**/*'],
              message:
                'Inline functions instead of importing relative files. Relative files are not available in dist.',
              allowTypeImports: true,
            },
            {
              group: ['./**/*'],
              message:
                'Inline functions instead of importing relative files. Relative files are not available in dist.',
              allowTypeImports: true,
            },
            {
              group: ['@nx/**/*'],
              message: 'Do not import Nx plugins.',
              allowTypeImports: true,
            },
            {
              group: ['nx/**/*'],
              message: 'Do not import Nx package.',
              allowTypeImports: true,
            },
          ],
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
            '@nx/webpack',
            '@nx/cypress',
            '@nx/jest',
            '@nx/playwright',
            'typescript',
            'react',
            'webpack',
            '@babel/plugin-proposal-decorators',
            'tailwindcss',
            '@svgr/webpack',
            '@nx/next',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
