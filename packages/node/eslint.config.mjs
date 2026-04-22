import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        '@nx/workspace',
        '@angular-devkit/core',
        '@angular-devkit/architect',
        '@angular-devkit/schematics',
      ],
    },
    ignores: ['./src/migrations/**'],
  },
  {
    files: ['./package.json', './generators.json', './migrations.json'],
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
            '@nx/angular',
            '@nx/module-federation',
            '@nx/nest',
            '@nx/playwright',
            '@nx/webpack',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
