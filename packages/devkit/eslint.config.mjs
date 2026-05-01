import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    ignores: ['dist'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            '@nx/workspace',
            '@angular-devkit/core',
            '@angular-devkit/architect',
            '@angular-devkit/schematics',
          ],
          patterns: [
            {
              group: [
                'nx/bin/*',
                'nx/src/*',
                'nx/plugins/*',
                '!nx/src/devkit-internals',
                '!nx/src/devkit-exports',
              ],
              allowTypeImports: true,
              message:
                'Only import from nx/src/devkit-internals or nx/src/devkit-exports',
            },
            {
              group: ['@nx/devkit/**/*'],
              message: 'Use a relative import',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    files: ['./package.json'],
    rules: {
      '@nx/nx-plugin-checks': 'error',
      '@nx/dependency-checks': [
        'error',
        {
          buildTargets: ['build-base'],
          ignoredDependencies: [
            'nx',
            'typescript',
            'prettier',
            'rxjs',
            '@angular-devkit/core',
            '@angular-devkit/architect',
            '@angular-devkit/schematics',
            'webpack',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
