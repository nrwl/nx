import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

// Oxlint lints this package's source via the `oxlint` target, but its config
// there is narrow — the correctness and suspicious categories plus `no-console`.
// ESLint still runs `baseConfig` for the repo-wide rules that config does not
// reproduce (module boundaries, restricted imports, the internal
// `@nx/workspace-*` rules), plus the JSON rules below: Oxlint has no JSON
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
