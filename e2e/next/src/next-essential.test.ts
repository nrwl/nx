/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * next package. It tests the core public API.
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

import { checkFilesExist, newProject, runCLI, uniq } from '@nx/e2e/utils';

describe('Next essential tests', () => {
  beforeAll(() => {
    newProject({ name: uniq('proj-next'), packages: ['@nx/next'] });
  });

  it('should be able to generate, build and lint projects ', () => {
    const appName = uniq('app1');
    const libName = uniq('@my-org/lib1');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/src/app/page.tsx`);
    // check build works
    expect(runCLI(`build ${appName}`)).toContain(
      `Successfully ran target build for project ${appName}`
    );
    // check tests pass
    const appTestResult = runCLI(`test ${appName} --passWithNoTests`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );

    runCLI(
      `generate @nx/next:lib ${libName} --buildable --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${libName}/src/index.ts`);
    // check build works
    expect(runCLI(`build ${libName}`)).toContain(
      `Successfully ran target build for project ${libName}`
    );
  }, 600_000);

  it('should support --custom-server flag (swc)', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --custom-server --linter=eslint --unitTestRunner=jest`
    );

    // Check for custom server files added to source
    checkFilesExist(`${appName}/server/main.ts`);
    checkFilesExist(`${appName}/.server.swcrc`);

    const result = runCLI(`build ${appName}`);

    checkFilesExist(`dist/${appName}-server/server/main.js`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  }, 300_000);
});
