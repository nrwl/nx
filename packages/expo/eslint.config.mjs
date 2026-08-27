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
            '@nx/jest',
            '@nx/rollup',
            '@nx/web',
            '@nx/webpack',
            '@nx/cypress',
            '@nx/playwright',
            '@nx/detox',
            'typescript',
            'eslint',
            'expo',
            'react',
            '@expo/cli',
            'eas-cli',
            'util',
            // resolved dynamically (per-app) in plugins/with-nx-metro.ts and
            // plugins/metro-resolver.ts
            'metro-config',
            'metro-resolver',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
