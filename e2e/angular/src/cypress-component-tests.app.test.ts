import { runCLI, runE2ETests } from '@nx/e2e-utils';
import {
  registerAngularCypressCTSetup,
  appName,
} from './cypress-component-tests.setup';

describe('Angular Cypress Component Tests - app', () => {
  registerAngularCypressCTSetup();

  it('should test app', () => {
    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${appName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
