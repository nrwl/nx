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
      // The nx-barrel import boundary moved to this package's .oxlintrc.json.
      '@typescript-eslint/explicit-module-boundary-types': 'error',
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
