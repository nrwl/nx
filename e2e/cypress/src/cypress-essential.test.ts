/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * cypress package. It tests the core public API.
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
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

describe('Cypress essential tests', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/react', '@nx/angular', '@nx/cypress'] });
  });

  afterAll(() => cleanupProject());

  describe('React', () => {
    const myapp = uniq('myapp');
    it('should generate and run a react app with the Cypress as e2e test runner', () => {
      runCLI(
        `generate @nx/react:app apps/${myapp} --e2eTestRunner=cypress --linter=none`
      );

      // Making sure the cypress folders & files are created
      checkFilesExist(`apps/${myapp}-e2e/cypress.config.ts`);
      checkFilesExist(`apps/${myapp}-e2e/tsconfig.json`);

      checkFilesExist(`apps/${myapp}-e2e/src/fixtures/example.json`);
      checkFilesExist(`apps/${myapp}-e2e/src/e2e/app.cy.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/app.po.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/e2e.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/commands.ts`);

      if (runE2ETests('cypress')) {
        const result = runCLI(`e2e ${myapp}-e2e`);
        expect(result).toContain('All specs passed!');
      }
    }, 600_000);
  });

  describe('Angular', () => {
    const myapp = uniq('myapp');
    it('should generate and run an angular app with the Cypress as e2e test runner', () => {
      runCLI(
        `generate @nx/angular:app apps/${myapp} --e2eTestRunner=cypress --linter=none`
      );

      // Making sure the cypress folders & files are created
      checkFilesExist(`apps/${myapp}-e2e/cypress.config.ts`);
      checkFilesExist(`apps/${myapp}-e2e/tsconfig.json`);

      checkFilesExist(`apps/${myapp}-e2e/src/fixtures/example.json`);
      checkFilesExist(`apps/${myapp}-e2e/src/e2e/app.cy.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/app.po.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/e2e.ts`);
      checkFilesExist(`apps/${myapp}-e2e/src/support/commands.ts`);

      if (runE2ETests('cypress')) {
        const result = runCLI(`e2e ${myapp}-e2e`);
        expect(result).toContain('All specs passed!');
      }
    }, 600_000);
  });
});
