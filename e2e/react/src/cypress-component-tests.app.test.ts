import { runCLI, runE2ETests } from '@nx/e2e-utils';
import {
  registerReactCypressCTSetup,
  appName,
} from './cypress-component-tests.setup';
import { join } from 'path';

describe('React Cypress Component Tests - app', () => {
  registerReactCypressCTSetup();

  it('should test app', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${appName} --generate-tests`
    );
    if (runE2ETests()) {
      expect(runCLI(`component-test ${appName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
