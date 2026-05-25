import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
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
    files: ['./package.json'],
    rules: {
      '@nx/nx-plugin-checks': 'error',
      '@nx/dependency-checks': [
        'error',
        {
          buildTargets: ['build-base'],
          ignoredFiles: [
            '{projectRoot}/eslint.config.mjs',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
          ignoredDependencies: [
            '@angular/core',
            'jsonc-eslint-parser',
            'semver',
            'vitest',
            'memfs',
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
