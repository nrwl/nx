/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * js package. It tests the core public API.
 *
 * FAILURE POLICY
 *  - If any test here fails, the package is considered broken.
 *  - Fix the underlying issue immediately, do not merge or release until green.
 *  - Do not update snapshots here without an accompanying, intentional code change.
 *
 * GUIDELINES
 *  - Keep tests small and focused on fundamental behavior.
 *  - No edge-cases we should only test the critical paths.
 *  - CI pipelines must block on failures in this file (no skips or timeouts).
 *
 * MAINTENANCE
 *  - Whenever you change core behavior, update this file first to cover the new expectations.
 *  - Add new “essential” tests here only if they test core functionality.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  detectPackageManager,
  newProject,
  packageManagerLockFile,
  readFile,
  readJson,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
  waitUntil,
} from '@nx/e2e/utils';

describe('Js essential tests', () => {
  let scope: string;

  describe('tsc', () => {
    beforeAll(() => {
      scope = newProject({ packages: ['@nx/js', '@nx/eslint', '@nx/jest'] });
    });

    afterAll(() => cleanupProject());

    it('should create a library that can be linted and tested', async () => {
      const libName = uniq('mylib');
      const dirName = uniq('dir');

      runCLI(
        `generate @nx/js:lib --name=${dirName}-${libName} --directory libs/${dirName}/${libName}`
      );

      checkFilesExist(
        `libs/${dirName}/${libName}/src/index.ts`,
        `libs/${dirName}/${libName}/README.md`
      );

      const result = runCLI(`lint ${dirName}-${libName}`);

      expect(result).toContain(
        `Successfully ran target lint for project ${dirName}-${libName}`
      );

      const testResult = await runCLIAsync(`test ${dirName}-${libName}`);
      expect(testResult.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 500_000);

    it('should create libs with js executors (--compiler=tsc)', async () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib} --bundler=tsc --no-interactive`);
      const libPackageJson = readJson(`libs/${lib}/package.json`);
      expect(libPackageJson.scripts).toBeUndefined();

      expect(runCLI(`build ${lib}`)).toContain(
        'Done compiling TypeScript files'
      );
      checkFilesExist(
        `dist/libs/${lib}/README.md`,
        `dist/libs/${lib}/package.json`,
        `dist/libs/${lib}/src/index.js`,
        `dist/libs/${lib}/src/lib/${lib}.js`,
        `dist/libs/${lib}/src/index.d.ts`,
        `dist/libs/${lib}/src/lib/${lib}.d.ts`
      );

      runCLI(`build ${lib} --generateLockfile=true`);
      checkFilesExist(
        `dist/libs/${lib}/package.json`,
        `dist/libs/${lib}/${
          packageManagerLockFile[detectPackageManager(tmpProjPath())]
        }`
      );

      updateJson(`libs/${lib}/project.json`, (json) => {
        json.targets.build.options.assets.push({
          input: `libs/${lib}/docs`,
          glob: '**/*.md',
          output: 'docs',
        });
        return json;
      });
      const libBuildProcess = await runCommandUntil(
        `build ${lib} --watch`,
        (output) => output.includes(`Watching for file changes`),
        {
          env: {
            NX_DAEMON: 'true',
          },
        }
      );
      updateFile(`libs/${lib}/README.md`, `Hello, World!`);
      updateJson(`libs/${lib}/package.json`, (json) => {
        json.version = '999.9.9';
        return json;
      });
      updateFile(`libs/${lib}/docs/a/b/nested.md`, 'Nested File');
      await expect(
        waitUntil(
          () =>
            readFile(`dist/libs/${lib}/README.md`).includes(`Hello, World!`),
          {
            timeout: 20_000,
            ms: 500,
          }
        )
      ).resolves.not.toThrow();
      await expect(
        waitUntil(
          () =>
            readFile(`dist/libs/${lib}/docs/a/b/nested.md`).includes(
              `Nested File`
            ),
          {
            timeout: 20_000,
            ms: 500,
          }
        )
      ).resolves.not.toThrow();
      await expect(
        waitUntil(
          () =>
            readFile(`dist/libs/${lib}/package.json`).includes(
              `"version": "999.9.9"`
            ),
          {
            timeout: 20_000,
            ms: 500,
          }
        )
      ).resolves.not.toThrow();
      libBuildProcess.kill();

      const parentLib = uniq('parentlib');
      runCLI(
        `generate @nx/js:lib libs/${parentLib} --bundler=tsc --no-interactive`
      );
      const parentLibPackageJson = readJson(`libs/${parentLib}/package.json`);
      expect(parentLibPackageJson.scripts).toBeUndefined();
      expect((await runCLIAsync(`test ${parentLib}`)).combinedOutput).toContain(
        'Ran all test suites'
      );

      expect(runCLI(`build ${parentLib}`)).toContain(
        'Done compiling TypeScript files'
      );
      checkFilesExist(
        `dist/libs/${parentLib}/package.json`,
        `dist/libs/${parentLib}/src/index.js`,
        `dist/libs/${parentLib}/src/lib/${parentLib}.js`,
        `dist/libs/${parentLib}/src/index.d.ts`,
        `dist/libs/${parentLib}/src/lib/${parentLib}.d.ts`
      );

      const tsconfig = readJson(`tsconfig.base.json`);
      expect(tsconfig.compilerOptions.paths).toMatchObject({
        [`@${scope}/${lib}`]: [`libs/${lib}/src/index.ts`],
        [`@${scope}/${parentLib}`]: [`libs/${parentLib}/src/index.ts`],
      });

      updateFile(`libs/${parentLib}/src/index.ts`, () => {
        return `
        import { ${lib} } from '@${scope}/${lib}'
        export * from './lib/${parentLib}';
      `;
      });

      const output = runCLI(`build ${parentLib}`);
      expect(output).toContain('1 task it depends on');
      expect(output).toContain('Done compiling TypeScript files');

      updateJson(`libs/${lib}/tsconfig.json`, (json) => {
        json.compilerOptions = { ...json.compilerOptions, importHelpers: true };
        return json;
      });

      updateJson(`libs/${lib}/package.json`, (json) => {
        // Delete automatically generated helper dependency to test legacy behavior.
        delete json.dependencies.tslib;
        return json;
      });

      // check batch build
      rmDist();
      let batchBuildOutput = runCLI(`build ${parentLib} --skip-nx-cache`, {
        env: { NX_BATCH_MODE: 'true' },
      });

      expect(batchBuildOutput).toContain(`Running 2 tasks with @nx/js:tsc`);
      expect(batchBuildOutput).toContain(
        `Compiling TypeScript files for project "${lib}"...`
      );
      expect(batchBuildOutput).toContain(
        `Done compiling TypeScript files for project "${lib}".`
      );
      expect(batchBuildOutput).toContain(
        `Compiling TypeScript files for project "${parentLib}"...`
      );
      expect(batchBuildOutput).toContain(
        `Done compiling TypeScript files for project "${parentLib}".`
      );
      expect(batchBuildOutput).toContain(
        `Successfully ran target build for project ${parentLib} and 1 task it depends on`
      );

      batchBuildOutput = runCLI(`build ${parentLib} --skip-nx-cache --batch`);
      expect(batchBuildOutput).toContain(`Running 2 tasks with @nx/js:tsc`);

      checkFilesExist(
        // parent
        `dist/libs/${parentLib}/package.json`,
        `dist/libs/${parentLib}/README.md`,
        `dist/libs/${parentLib}/tsconfig.tsbuildinfo`,
        `dist/libs/${parentLib}/src/index.js`,
        `dist/libs/${parentLib}/src/index.d.ts`,
        `dist/libs/${parentLib}/src/lib/${parentLib}.js`,
        `dist/libs/${parentLib}/src/lib/${parentLib}.d.ts`,
        // child
        `dist/libs/${lib}/package.json`,
        `dist/libs/${lib}/README.md`,
        `dist/libs/${lib}/tsconfig.tsbuildinfo`,
        `dist/libs/${lib}/src/index.js`,
        `dist/libs/${lib}/src/index.d.ts`,
        `dist/libs/${lib}/src/lib/${lib}.js`,
        `dist/libs/${lib}/src/lib/${lib}.d.ts`
      );

      // run a second time skipping the nx cache and with the outputs present
      const secondBatchBuildOutput = runCLI(
        `build ${parentLib} --skip-nx-cache`,
        { env: { NX_BATCH_MODE: 'true' } }
      );
      expect(secondBatchBuildOutput).toContain(
        `Successfully ran target build for project ${parentLib} and 1 task it depends on`
      );
    }, 240_000);
  });

  describe('swc', () => {
    beforeAll(() => {
      scope = newProject({ packages: ['@nx/js', '@nx/eslint', '@nx/jest'] });
    });

    afterAll(() => cleanupProject());

    it('should create libs with js executors (--bundler=swc)', async () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib} --bundler=swc --no-interactive`);

      const libPackageJson = readJson(`libs/${lib}/package.json`);
      expect(libPackageJson.scripts).toBeUndefined();

      expect(() => runCLI(`build ${lib}`)).not.toThrow();
      checkFilesExist(
        `dist/libs/${lib}/package.json`,
        `dist/libs/${lib}/src/index.js`,
        `dist/libs/${lib}/src/lib/${lib}.js`,
        `dist/libs/${lib}/src/index.d.ts`,
        `dist/libs/${lib}/src/lib/${lib}.d.ts`
      );

      const tsconfig = readJson(`tsconfig.base.json`);
      expect(tsconfig.compilerOptions.paths).toEqual({
        [`@${scope}/${lib}`]: [`libs/${lib}/src/index.ts`],
      });
    }, 240_000);
  });
});
