import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  { ignores: ['dist'] },
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
    files: ['./package.json', './generators.json', './executors.json'],
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
            '@typescript/typescript6',
            'eslint',
            // Declared as an optional peer because the inferred plugin emits
            // targets that run the `webpack-cli` binary; it is never imported,
            // so the dependency check can't detect the usage statically.
            'webpack-cli',
            '@babel/core',
            'css-loader',
            'less',
            'less-loader',
            'postcss-loader',
            'sass',
            'sass-embedded',
            'sass-loader',
            'style-loader',
            'source-map-loader',
            'swc-loader',
            '@swc/core',
            'ts-loader',
            'ajv',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
