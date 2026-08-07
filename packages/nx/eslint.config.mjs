import { allowDirectNxImports, baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

// A later block configuring the same rule replaces its options wholesale, so
// the scoped migrate blocks below must restate these repo-wide restrictions.
const tsRestrictedImportPaths = [
  {
    name: 'typescript',
    message:
      'TypeScript is an optional dependency for Nx. If you need to use it, make sure its installed first with ensureTypescript.',
    allowTypeImports: true,
  },
];

const tsRestrictedImportPatterns = [
  {
    group: ['nx/*'],
    message: "Circular import in 'nx' found. Use relative path.",
  },
  {
    group: ['**/native-bindings', '**/native-bindings.js'],
    message:
      'Direct imports from native-bindings.js are not allowed. Import from index.js instead.',
  },
];

// Depth-independent: matches './run/*' from migrate/ itself and '../run/*',
// '../../run/*', ... from any nested subtree. From migrate/ itself '../run/*'
// points at the sibling command-line/run; blocking that too is fine, migrate
// code has no business in the run command's internals either.
const migrateRunBarrelPattern = {
  group: ['**/run/*'],
  message:
    "Import migrate/run's public surface by importing the run directory itself, not its internal modules directly.",
};

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fs-extra',
              message:
                'Please use equivalent utilities from `node:fs` instead.',
            },
            {
              name: 'chalk',
              message:
                'Please use `picocolors` instead. For an orange color, import `orange` from `utils/output`.',
            },
          ],
          patterns: [
            {
              group: ['**/devkit-exports'],
              message: 'Do not import from devkit-exports from the nx package',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: tsRestrictedImportPaths,
          patterns: tsRestrictedImportPatterns,
        },
      ],
    },
    ignores: ['**/*.spec.ts'],
  },
  {
    // The ignores exempt spec files, as the sibling import-boundary blocks
    // do. migrate.ts and run/ need no entry here: their dedicated blocks
    // below replace this rule's options wholesale (see the header note).
    files: ['src/command-line/migrate/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: tsRestrictedImportPaths,
          patterns: [
            ...tsRestrictedImportPatterns,
            migrateRunBarrelPattern,
            {
              group: ['**/execute-migration', '**/execute-migration.js'],
              message:
                'Import the execution engine through the migrate module, which re-exports its whole surface.',
            },
          ],
        },
      ],
    },
    ignores: ['**/*.spec.ts'],
  },
  {
    // migrate.ts imports execute-migration directly to be the module that
    // re-exports it, so this block drops the engine pattern and keeps the
    // run barrel boundary.
    files: ['src/command-line/migrate/migrate.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: tsRestrictedImportPaths,
          patterns: [...tsRestrictedImportPatterns, migrateRunBarrelPattern],
        },
      ],
    },
  },
  {
    // run/ owns the durable run-state format. It takes the engine directly:
    // routing it through migrate.ts would close the cycle the pattern below
    // blocks.
    files: ['src/command-line/migrate/run/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: tsRestrictedImportPaths,
          patterns: [
            ...tsRestrictedImportPatterns,
            {
              group: ['**/migrate', '**/migrate.js'],
              message:
                "Importing migrate.ts from migrate/run closes an import cycle: migrate.ts already imports run's barrel. Import the shared helper modules under migrate/ directly instead.",
            },
          ],
        },
      ],
    },
    ignores: ['**/*.spec.ts'],
  },
  {
    files: ['./package.json', './executors.json', './migrations.json'],
    rules: {
      '@nx/nx-plugin-checks': [
        'error',
        {
          allowedVersionStrings: ['latest'],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    files: ['nxw.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*', '!fs'],
              message:
                'The Nx wrapper is ran before packages are installed. It should only import node builtins.',
              allowTypeImports: true,
            },
          ],
        },
      ],
      'no-restricted-modules': [
        'error',
        {
          patterns: ['*', '!fs', '!path', '!child_process', '!node:*'],
        },
      ],
      'no-restricted-imports': 'off',
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
            '@nrwl/angular',
            '@angular-devkit/build-angular',
            '@angular/build',
            '@angular-devkit/core',
            '@angular-devkit/architect',
            '@swc/core',
            '@swc/node-register',
            'rxjs',
            '@angular-devkit/schematics',
            '@pnpm/lockfile-types',
            '@nestjs/cli',
            'ts-node',
            'memfs',
            'events',
            'process',
            'prettier',
            'util',
            '@nx/nx-darwin-x64',
            '@nx/nx-darwin-arm64',
            '@nx/nx-linux-x64-gnu',
            '@nx/nx-linux-x64-musl',
            '@nx/nx-win32-x64-msvc',
            '@nx/nx-linux-arm64-gnu',
            '@nx/nx-linux-arm64-musl',
            '@nx/nx-linux-arm-gnueabihf',
            '@nx/nx-win32-arm64-msvc',
            '@nx/nx-freebsd-x64',
            '@nx/powerpack-license',
            '@nx/key',
            '@nx/powerpack-conformance',
            '@nx/conformance',
            '@nx/docker',
            '@napi-rs/wasm-runtime',
            'enhanced-resolve',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    ignores: ['**/__fixtures__/**/*', 'dist', 'native-packages/**/*'],
  },
  // Scoped to spec files on purpose. `allowDirectNxImports` defaults to matching
  // every file, so an unscoped append would *replace* (flat config does not merge
  // rule options) the `@typescript-eslint/no-restricted-imports` configurations
  // above — silently dropping the `typescript` optional-dependency ban and the
  // `nx/*` circular-import ban for all of packages/nx. `files` must come AFTER
  // the spread to win.
  // Spec files need the exemption because the `**/*.ts` block above redefines
  // the rule and carries `ignores: ['**/*.spec.ts']`, leaving them on the root
  // rule.
  { ...allowDirectNxImports, files: ['**/*.spec.ts'] },
];
