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
      '@typescript-eslint/no-var-requires': 'off',
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
            'eslint',
            'prettier',
            'typescript',
            'react',
            '@nx/workspace',
            'fs-extra',
            '@remix-run/dev',
            '@nx/web',
            '@nx/eslint',
            '@nx/cypress',
            '@nx/playwright',
            '@nx/jest',
            '@nx/rollup',
            '@nx/storybook',
            '@nx/vite',
            '@nx/vitest',
            '@nx/webpack',
            '@babel/preset-react',
            '@phenomnomnominal/tsquery',
            '@pmmmwh/react-refresh-webpack-plugin',
            '@svgr/rollup',
            '@rollup/plugin-url',
            '@svgr/webpack',
            '@swc/jest',
            'babel-jest',
            'babel-loader',
            'babel-plugin-emotion',
            'babel-plugin-styled-components',
            'css-loader',
            'file-loader',
            'less-loader',
            'react-refresh',
            'rollup',
            'sass',
            'sass-loader',
            'style-loader',
            'swc-loader',
            'tsconfig-paths-webpack-plugin',
            'webpack',
            'webpack-merge',
            'vite',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
