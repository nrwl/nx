import { runCLI, runE2ETests } from '@nx/e2e-utils';

import {
  setupReactCypressSuite,
  teardownReactCypressSuite,
} from './cypress-component-tests.setup';

describe('React Cypress Component Tests - app', () => {
  const context = setupReactCypressSuite();

  afterAll(() => teardownReactCypressSuite());

  it('should test app', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${context.appName} --generate-tests`
    );
    if (runE2ETests()) {
      expect(runCLI(`component-test ${context.appName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
