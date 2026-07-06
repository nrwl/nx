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
          name: 'minimatch',
          message: 'Please use `picomatch` instead.',
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
            '@nx/cypress',
            '@nx/playwright',
            '@nx/storybook',
            '@nx/rsbuild',
            'eslint',
            // Declared as optional peers for multi-version support signalling;
            // installed into the user's app by generators, not imported by the
            // plugin's own source.
            'vue',
            'vue-router',
            'vue-tsc',
            '@vitejs/plugin-vue',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
