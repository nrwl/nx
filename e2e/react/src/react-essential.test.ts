/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * react package. It tests the core public API.
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
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('React essential tests', () => {
  beforeAll(() => {
    newProject({
      packages: [
        '@nx/react',
        '@nx/eslint',
        '@nx/jest',
        '@nx/vite',
        '@nx/webpack',
        '@nx/rspack',
      ],
    });
  });

  afterAll(() => cleanupProject());
  describe('Vite', () => {
    it('should be able to generate, build, test and lint an application', async () => {
      const reactapp = uniq('reactapp');

      runCLI(
        `generate @nx/react:app apps/${reactapp} --linter=eslint --unitTestRunner=jest`
      );

      checkFilesExist(`apps/${reactapp}/vite.config.ts`);
      checkFilesExist(`apps/${reactapp}/src/app/app.tsx`);

      const buildResult = runCLI(`build ${reactapp}`);
      const lintResult = runCLI(`lint ${reactapp}`);
      const testResult = runCLI(`test ${reactapp} --passWithNoTests`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${reactapp}`
      );

      checkFilesExist(`dist/apps/${reactapp}/index.html`);
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${reactapp}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${reactapp}`
      );
    }, 600_000);

    it('should be able to generate, build, test and lint a library', async () => {
      const reactlib = uniq('reactlib');

      runCLI(
        `generate @nx/react:lib --directory=libs/${reactlib} --bundler=vite --linter=eslint --unitTestRunner=vitest`
      );

      checkFilesExist(`libs/${reactlib}/vite.config.ts`);
      checkFilesExist(`libs/${reactlib}/src/lib/${reactlib}.tsx`);

      const buildResult = runCLI(`build ${reactlib}`);
      const lintResult = runCLI(`lint ${reactlib}`);
      const testResult = runCLI(`test ${reactlib} --passWithNoTests`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${reactlib}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${reactlib}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${reactlib}`
      );
    }, 600_000);
  });

  describe('Webpack', () => {
    it('should be able to generate, build, test and lint an application', async () => {
      const reactapp = uniq('reactapp');

      runCLI(
        `generate @nx/react:app apps/${reactapp} --bundler=webpack --linter=eslint --unitTestRunner=jest`
      );

      checkFilesExist(`apps/${reactapp}/webpack.config.js`);
      checkFilesExist(`apps/${reactapp}/src/app/app.tsx`);

      const buildResult = runCLI(`build ${reactapp}`);
      const lintResult = runCLI(`lint ${reactapp}`);
      const testResult = runCLI(`test ${reactapp} --passWithNoTests`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${reactapp}`
      );

      checkFilesExist(`dist/apps/${reactapp}/index.html`);
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${reactapp}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${reactapp}`
      );
    }, 600_000);
  });

  describe('Rspack', () => {
    it('should be able to generate, build, test and lint an application', async () => {
      const reactapp = uniq('reactapp');

      runCLI(
        `generate @nx/react:app apps/${reactapp} --bundler=rspack --linter=eslint --unitTestRunner=jest`
      );

      checkFilesExist(`apps/${reactapp}/rspack.config.js`);
      checkFilesExist(`apps/${reactapp}/src/app/app.tsx`);

      const buildResult = runCLI(`build ${reactapp}`);
      const lintResult = runCLI(`lint ${reactapp}`);
      const testResult = runCLI(`test ${reactapp} --passWithNoTests`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${reactapp}`
      );
      checkFilesExist(`dist/apps/${reactapp}/index.html`);
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${reactapp}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${reactapp}`
      );
    }, 600_000);
  });

  describe('Rsbuild', () => {
    it('should be able to generate, build, test and lint an application', async () => {
      const reactapp = uniq('reactapp');

      runCLI(
        `generate @nx/react:app apps/${reactapp} --bundler=rsbuild --linter=eslint --unitTestRunner=jest`
      );

      checkFilesExist(`apps/${reactapp}/rsbuild.config.ts`);
      checkFilesExist(`apps/${reactapp}/src/app/app.tsx`);

      const buildResult = runCLI(`build ${reactapp}`);
      const lintResult = runCLI(`lint ${reactapp}`);
      const testResult = runCLI(`test ${reactapp} --passWithNoTests`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${reactapp}`
      );
      checkFilesExist(`apps/${reactapp}/dist/index.html`);
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${reactapp}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${reactapp}`
      );
    }, 600_000);
  });

  describe('Rollup', () => {
    it('should be able to generate, build, test and lint a library', async () => {
      const reactlib = uniq('reactlib');

      runCLI(
        `generate @nx/react:lib --directory=libs/${reactlib} --bundler=rollup --linter=eslint --unitTestRunner=jest`
      );

      checkFilesExist(`libs/${reactlib}/rollup.config.cjs`);
      checkFilesExist(`libs/${reactlib}/src/lib/${reactlib}.tsx`);

      const buildResult = runCLI(`build ${reactlib}`);
      const lintResult = runCLI(`lint ${reactlib}`);
      const testResult = runCLI(`test ${reactlib} --passWithNoTests`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${reactlib}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${reactlib}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${reactlib}`
      );
    });
  });
});
