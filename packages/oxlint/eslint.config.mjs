import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

// Oxlint lints this package's source via the `oxlint` target; its .oxlintrc.json
// extends the root config (module boundaries, restricted imports) and adds the
// suspicious category and `no-console`. ESLint still runs `baseConfig` for the
// internal `@nx/workspace-*` rules and the JSON rules below: Oxlint has no JSON
// linter, so those cannot move.
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
