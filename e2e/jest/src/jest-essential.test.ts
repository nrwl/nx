/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * jest package. It tests the core public API.
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
  cleanupProject,
  expectJestTestsToPass,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { stripIndents } from 'nx/src/devkit-exports';

describe('Jest essential tests', () => {
  beforeAll(() => {
    newProject({ name: uniq('proj-jest'), packages: ['@nx/js', '@nx/node'] });
  });

  afterAll(() => cleanupProject());

  it('should be able test projects using jest', async () => {
    await expectJestTestsToPass('@nx/js:lib --unitTestRunner=jest');
  }, 500000);

  it('should be resilient against NODE_ENV values', async () => {
    const name = uniq('lib');
    runCLI(
      `generate @nx/js:lib ${name} --unitTestRunner=jest --no-interactive`
    );

    const results = await runCLIAsync(`test ${name} --skip-nx-cache`, {
      silenceError: true,
      env: {
        ...process.env, // need to set this for some reason, or else get "env: node: No such file or directory"
        NODE_ENV: 'foobar',
      },
    });
    expect(results.combinedOutput).toContain('Test Suites: 1 passed, 1 total');
  });

  it('should merge with jest config globals', async () => {
    const testGlobal = `'My Test Global'`;
    const mylib = uniq('mylib');
    const utilLib = uniq('util-lib');
    runCLI(
      `generate @nx/js:lib libs/${mylib} --unitTestRunner=jest --no-interactive`
    );
    runCLI(
      `generate @nx/js:lib libs/${utilLib} --importPath=@global-fun/globals --unitTestRunner=jest --no-interactive`
    );
    updateFile(
      `libs/${utilLib}/src/index.ts`,
      stripIndents`
      export function setup() {console.log('i am a global setup function')}
      export function teardown() {console.log('i am a global teardown function')}
    `
    );

    updateFile(`libs/${mylib}/src/lib/${mylib}.ts`, `export class Test { }`);

    updateFile(
      `libs/${mylib}/src/lib/${mylib}.spec.ts`,
      `
          test('can access jest global', () => {
            expect((global as any).testGlobal).toBe(${testGlobal});
          });
        `
    );

    updateFile(
      `libs/${mylib}/setup.ts`,
      stripIndents`
      const { registerTsProject } = require('@nx/js/src/internal');
      const { join } = require('path');
      const cleanup = registerTsProject(join(__dirname, '../../tsconfig.base.json'));

      import {setup} from '@global-fun/globals';
      export default async function() {setup();}

      cleanup();
    `
    );

    updateFile(
      `libs/${mylib}/teardown.ts`,
      stripIndents`
      const { registerTsProject } = require('@nx/js/src/internal');
      const { join } = require('path');
      const cleanup = registerTsProject(join(__dirname, '../../tsconfig.base.json'));

      import {teardown} from '@global-fun/globals';
      export default async function() {teardown();}
      cleanup();
    `
    );

    updateFile(
      `libs/${mylib}/jest.config.ts`,
      stripIndents`
        export default {
          testEnvironment: 'node',
          displayName: "${mylib}",
          preset: "../../jest.preset.js",
          transform: {
            "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
          },
          moduleFileExtensions: ["ts", "js", "html"],
          coverageDirectory: "../../coverage/libs/${mylib}",
          globals: { testGlobal: ${testGlobal} },
          globalSetup: '<rootDir>/setup.ts',
          globalTeardown: '<rootDir>/teardown.ts'
        };`
    );

    const appResult = await runCLIAsync(`test ${mylib} --no-watch`, {
      silenceError: true,
    });
    expect(appResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 300000);

  it('should set the NODE_ENV to `test`', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nx/js:lib libs/${mylib} --unitTestRunner=jest`);

    updateFile(
      `libs/${mylib}/src/lib/${mylib}.spec.ts`,
      `
        test('can access jest global', () => {
          expect(process.env['NODE_ENV']).toBe('test');
        });
        `
    );
    const appResult = await runCLIAsync(`test ${mylib} --no-watch`);
    expect(appResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 90000);
});
