import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  { ignores: ['dist'] },
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        '@angular-devkit/architect',
        '@angular-devkit/core',
        '@angular-devkit/schematics',
        '@nx/workspace',
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
            '@typescript/typescript6',
            'eslint',
            'nest',
            '@nestjs/schematics',
            '@nestjs/core',
            '@nestjs/common',
            'reflect-metadata',
            'rxjs',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
