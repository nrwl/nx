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
    files: ['./package.json'],
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
          ignoredFiles: [
            '{projectRoot}/.eslintrc.json',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
          ignoredDependencies: [
            '@rspack/core',
            '@angular/core',
            'jsonc-eslint-parser',
            'vitest',
            'memfs',
            'sass',
            'tailwindcss',
            '@babel/core',
            'autoprefixer',
            'css-loader',
            'jsonc-parser',
            'less-loader',
            'loader-utils',
            'open',
            'ora',
            'parse5-html-rewriting-stream',
            'piscina',
            'postcss',
            'postcss-loader',
            'rxjs',
            'sass-loader',
            'sass-embedded',
            'webpack-merge',
            'ws',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    ignores: ['dist'],
  },
];
