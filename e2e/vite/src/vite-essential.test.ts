/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * vite package. It tests the core public API.
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
  killProcessAndPorts,
  newProject,
  readJson,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

describe('Vite essential tests', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/js', '@nx/vite'] });
  });
  afterAll(() => {
    cleanupProject();
  });

  it('should be able to build, test and typecheck a library with vite', () => {
    const viteLib = uniq('vite-lib');
    runCLI(
      `generate @nx/js:lib packages/${viteLib} --bundler=vite --e2eTestRunner=none`
    );

    const buildResult = runCLI(`build ${viteLib}`);
    const typecheckResult = runCLI(`typecheck ${viteLib}`);
    const testResult = runCLI(`test ${viteLib} --passWithNoTests`);

    expect(buildResult).toContain(
      `Successfully ran target build for project ${viteLib}`
    );
    expect(testResult).toContain(
      `Successfully ran target test for project ${viteLib}`
    );
    expect(typecheckResult).toContain(
      `Successfully ran target typecheck for project ${viteLib}`
    );
  });
});
