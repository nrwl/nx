import { runCLI, runE2ETests } from '@nx/e2e-utils';
import {
  setupCypressComponentTests,
  cleanupCypressComponentTests,
  CypressComponentTestsSetup,
} from './cypress-component-tests-setup';

describe('Angular Cypress Component Tests - Zone.js projects', () => {
  let setup: CypressComponentTestsSetup;

  beforeAll(async () => {
    setup = setupCypressComponentTests(false);
  });

  afterAll(() => cleanupCypressComponentTests());

  it('should successfully run for an app', () => {
    const { appName } = setup;

    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${appName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);

  it('should successfully run for a lib', () => {
    const { usedInAppLibName } = setup;

    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${usedInAppLibName} --generate-tests --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${usedInAppLibName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
