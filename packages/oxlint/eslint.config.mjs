import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

// Oxlint lints this package's source via the `oxlint` target; ESLint still runs
// `baseConfig` here for the repo-wide rules Oxlint has no equivalent for (module
// boundaries, restricted imports), plus the JSON rules below — Oxlint does not
// parse JSON.
export default [
  ...baseConfig,
  {
    ignores: ['dist'],
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
            // Self-reference: resolves the package's own package.json at
            // runtime (see src/utils/versions.ts).
            '@nx/oxlint',
            // Declared as an optional peer, installed by `init` — never
            // imported, so the rule cannot see it is used.
            'oxlint',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
