import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    // The import-boundary side of this rule (utils/output must be reached
    // through run/agent-output) lives in this package's .oxlintrc.json.
    files: ['src/command-line/migrate/run/**/*.ts'],
    rules: {
      // console writes the two streams the agent reads, with nothing in
      // between; see the utils/output restriction in .oxlintrc.json.
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          // Both spellings: `process.stdout.write(...)` and a `stdout` (or
          // `stderr`) pulled off `process`/`node:process` and written to.
          selector:
            "MemberExpression[object.object.name='process'][object.property.name=/^(stdout|stderr)$/][property.name='write'], MemberExpression[object.name=/^(stdout|stderr)$/][property.name='write']",
          message:
            'Emit blocks through run/agent-output rather than writing to a stream directly, so framing and escaping stay in one place.',
        },
        {
          selector:
            'ImportDeclaration[source.value=/^(node:)?process$/] ImportSpecifier[imported.name=/^(stdout|stderr)$/]',
          message:
            'Importing a stream here is the same bypass as writing to process.stdout: go through run/agent-output.',
        },
      ],
    },
    ignores: ['**/*.spec.ts', '**/run/agent-output.ts'],
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
    // The builtins-only import boundary lives in this package's
    // .oxlintrc.json; this covers the require() spelling.
    files: ['nxw.ts'],
    rules: {
      'no-restricted-modules': [
        'error',
        {
          patterns: ['*', '!fs', '!path', '!child_process', '!node:*'],
        },
      ],
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
            'oxfmt',
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
];
