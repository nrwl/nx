/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * angular package. It tests the core public API.
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
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { join } from 'node:path';

describe('Angular essential tests', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/angular', '@nx/eslint', '@nx/jest'] });
  });

  afterAll(() => cleanupProject());

  describe('Webpack', () => {
    it('should be able to generate, build, test and lint an application', async () => {
      const appName = uniq('app');

      runCLI(
        `generate @nx/angular:app apps/${appName} --linter=eslint --bundler=webpack`
      );

      checkFilesExist(`apps/${appName}/src/app/app.component.ts`);
      checkFilesExist(`apps/${appName}/src/app/app.config.ts`);

      const buildResult = runCLI(`build ${appName}`);
      const lintResult = runCLI(`lint ${appName}`);
      const testResult = runCLI(`test ${appName}`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${appName}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${appName}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${appName}`
      );
    }, 200_000);
  });

  describe('Rspack', () => {
    it('should be able to generate, build, test and lint an application', async () => {
      const appName = uniq('app');

      runCLI(
        `generate @nx/angular:app apps/${appName} --linter=eslint --bundler=rspack`
      );

      const rspackConfigFileContents = readFile(
        join('apps', appName, 'rspack.config.ts')
      );
      const updatedConfigFileContents = rspackConfigFileContents.replace(
        `maximumError: '1mb'`,
        `maximumError: '3mb'`
      );
      updateFile(
        join('apps', appName, 'rspack.config.ts'),
        updatedConfigFileContents
      );

      checkFilesExist(`apps/${appName}/src/app/app.component.ts`);
      checkFilesExist(`apps/${appName}/src/app/app.config.ts`);
      checkFilesExist(`apps/${appName}/rspack.config.ts`);

      const buildResult = runCLI(`build ${appName}`);
      const lintResult = runCLI(`lint ${appName}`);
      const testResult = runCLI(`test ${appName}`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${appName}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${appName}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${appName}`
      );
    }, 200_000);
  });

  describe('Esbuild (default)', () => {
    it('should be able to generate, build, test and lint an application', async () => {
      const appName = uniq('app');

      runCLI(`generate @nx/angular:app apps/${appName} --linter=eslint`);

      checkFilesExist(`apps/${appName}/src/app/app.component.ts`);
      checkFilesExist(`apps/${appName}/src/app/app.config.ts`);

      const buildResult = runCLI(`build ${appName}`);
      const lintResult = runCLI(`lint ${appName}`);
      const testResult = runCLI(`test ${appName}`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${appName}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${appName}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${appName}`
      );
    }, 200_000);

    it('should be able to generate, build, test and lint a library', async () => {
      const libName = uniq('lib');

      runCLI(
        `generate @nx/angular:lib libs/${libName} --linter=eslint --buildable=true`
      );

      checkFilesExist(`libs/${libName}/src/index.ts`);
      checkFilesExist(
        `libs/${libName}/src/lib/${libName}/${libName}.component.ts`
      );

      const buildResult = runCLI(`build ${libName}`);
      const lintResult = runCLI(`lint ${libName}`);
      const testResult = runCLI(`test ${libName}`);

      expect(buildResult).toContain(
        `Successfully ran target build for project ${libName}`
      );
      expect(testResult).toContain(
        `Successfully ran target test for project ${libName}`
      );
      expect(lintResult).toContain(
        `Successfully ran target lint for project ${libName}`
      );
    }, 200_000);
  });
});
