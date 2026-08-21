import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    ignores: ['dist'],
  },
  {
    files: ['./package.json', './executors.json', './generators.json'],
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
            // Self-reference: resolves the package's own package.json at
            // runtime (see src/utils/versions.ts).
            '@nx/playwright',
            'typescript',
            '@typescript/typescript6',
            '@playwright/test',
            '@nx/webpack',
            '@nx/vite',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
