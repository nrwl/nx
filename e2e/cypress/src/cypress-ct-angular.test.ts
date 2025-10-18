import { killPort, runCLI, runE2ETests, uniq } from '@nx/e2e-utils';
import { setupCypressTest, cleanupCypressTest } from './cypress-setup';

const TEN_MINS_MS = 600_000;

describe('Cypress E2E Test runner', () => {
  beforeAll(() => {
    setupCypressTest();
  });

  afterAll(() => cleanupCypressTest());

  it(
    `should allow CT and e2e in same project for an angular project`,
    async () => {
      let appName = uniq(`angular-cy-app`);
      runCLI(
        `generate @nx/angular:app apps/${appName} --e2eTestRunner=none --no-interactive --bundler=webpack`
      );
      runCLI(
        `generate @nx/angular:component apps/${appName}/src/app/btn/btn --no-interactive`
      );
      runCLI(
        `generate @nx/angular:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
      );
      runCLI(
        `generate @nx/cypress:e2e --project=${appName} --baseUrl=http://localhost:4200 --no-interactive`
      );

      if (runE2ETests('cypress')) {
        expect(runCLI(`run ${appName}:component-test`)).toContain(
          'All specs passed!'
        );
        expect(runCLI(`run ${appName}:e2e`)).toContain('All specs passed!');
      }
      expect(await killPort(4200)).toBeTruthy();
    },
    TEN_MINS_MS
  );
});
