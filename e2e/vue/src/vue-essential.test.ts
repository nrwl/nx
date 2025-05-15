/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * vue package. It tests the core public API.
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
import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e/utils';
describe('Vue essential tests', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/vue', '@nx/vite', '@nx/rspack', '@nx/eslint'],
    });
  });

  afterAll(() => cleanupProject());

  describe('Vite', () => {
    it('should build, test and lint an application', async () => {
      const app = uniq('app');

      runCLI(
        `generate @nx/vue:app ${app} --unitTestRunner=vitest --linter=eslint --e2eTestRunner=none`
      );
      const buildResult = runCLI(`build ${app}`);
      const lintResult = runCLI(`lint ${app}`);
      const testResult = runCLI(`test ${app}`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${app}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${app}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${app}`
      );
    }, 200_000);

    it('should be able to generate, build a library', async () => {
      const lib = uniq('lib');

      runCLI(
        `generate @nx/vue:lib --directory=${lib} --bundler=vite --linter=eslint`
      );

      const buildResult = runCLI(`build ${lib}`);
      const lintResult = runCLI(`lint ${lib}`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${lib}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${lib}`
      );
    }, 200_000);
  });

  describe('Rsbuild', () => {
    it('should generate, build, test and lint an application', async () => {
      const app = uniq('app');

      runCLI(
        `generate @nx/vue:app ${app} --bundler=rsbuild --unitTestRunner=vitest --linter=eslint --e2eTestRunner=none`
      );
      const buildResult = runCLI(`build ${app}`);
      const lintResult = runCLI(`lint ${app}`);
      const testResult = runCLI(`test ${app}`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${app}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${app}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${app}`
      );
    }, 200_000);
  });
});
