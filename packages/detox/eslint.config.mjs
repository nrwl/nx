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
            'typescript',
            'detox',
            '@nx/cypress',
            '@nx/docker',
            '@nx/module-federation',
            '@nx/nest',
            '@nx/node',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
