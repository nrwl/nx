import { killPort, runCLI, runE2ETests, uniq } from '@nx/e2e-utils';
import { setupCypressTest, cleanupCypressTest } from './cypress-setup';

const TEN_MINS_MS = 600_000;

describe('Cypress E2E Test runner', () => {
  beforeAll(() => {
    setupCypressTest();
  });

  afterAll(() => cleanupCypressTest());

  it(
    `should allow CT and e2e in same project for a next project`,
    async () => {
      const appName = uniq('next-cy-app');
      runCLI(
        `generate @nx/next:app apps/${appName} --e2eTestRunner=none --no-interactive `
      );
      runCLI(
        `generate @nx/next:component apps/${appName}/components/btn --no-interactive`
      );
      runCLI(
        `generate @nx/next:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
      );
      runCLI(
        `generate @nx/cypress:configuration --project=${appName} --devServerTarget=${appName}:dev --baseUrl=http://localhost:3000 --no-interactive`
      );

      if (runE2ETests('cypress')) {
        expect(runCLI(`run ${appName}:component-test`)).toContain(
          'All specs passed!'
        );
        expect(runCLI(`run ${appName}:e2e`)).toContain('All specs passed!');
      }
      expect(await killPort(3000)).toBeTruthy();
    },
    TEN_MINS_MS
  );
});
