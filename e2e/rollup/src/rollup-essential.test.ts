/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * rollup package. It tests the core public API.
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
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  rmDist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('Rollup essential tests', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/rollup', '@nx/eslint', '@nx/jest'],
    });
  });

  afterAll(() => cleanupProject());

  it('should be able to setup project to build node programs with rollup and different compilers', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=rollup`
    );
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    // babel (default)
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --tsConfig=./tsconfig.lib.json --main=./src/index.ts`
    );
    updateFile(
      `libs/${myPkg}/rollup.config.cjs`,
      `
      const { withNx } = require('@nx/rollup/with-nx');
      module.exports =  withNx({
        outputPath: '../../dist/libs/${myPkg}',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        compiler: 'babel',
        generateExportsField: true,
        additionalEntryPoints: ['./src/{foo,bar}.ts'],
        format: ['cjs', 'esm']
      });
    `
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    checkFilesExist(`dist/libs/${myPkg}/index.cjs.d.ts`);
    expect(readJson(`dist/libs/${myPkg}/package.json`).exports).toEqual({
      '.': {
        module: './index.esm.js',
        import: './index.cjs.mjs',
        default: './index.cjs.js',
        types: './index.esm.d.ts',
      },
      './package.json': './package.json',
    });
    let output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);

    // swc
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --tsConfig=./tsconfig.lib.json --main=./src/index.ts --compiler=swc`
    );
    updateFile(
      `libs/${myPkg}/rollup.config.cjs`,
      `
      const { withNx } = require('@nx/rollup/with-nx');
      module.exports =  withNx({
        outputPath: '../../dist/libs/${myPkg}',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        compiler: 'swc',
        generateExportsField: true,
        additionalEntryPoints: ['./src/{foo,bar}.ts'],
        format: ['cjs', 'esm']
      });
    `
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);

    // tsc
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --tsConfig=./tsconfig.lib.json --main=./src/index.ts --compiler=tsc`
    );
    updateFile(
      `libs/${myPkg}/rollup.config.cjs`,
      `
      const { withNx } = require('@nx/rollup/with-nx');
      module.exports =  withNx({
        outputPath: '../../dist/libs/${myPkg}',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        compiler: 'tsc',
        generateExportsField: true,
        additionalEntryPoints: ['./src/{foo,bar}.ts'],
        format: ['cjs', 'esm']
      });
    `
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);
  }, 500_000);
});
