import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  { ignores: ['dist'] },
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
            'react-dom',
            '@nx/cypress',
            '@nx/playwright',
            '@nx/jest',
            '@nx/rollup',
            '@nx/rsbuild',
            '@nx/rspack',
            '@nx/storybook',
            '@nx/vite',
            '@nx/vitest',
            '@nx/webpack',
            '@module-federation/node',
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
