import { runCLI, runE2ETests } from '@nx/e2e-utils';

import {
  setupReactCypressSuite,
  teardownReactCypressSuite,
} from './cypress-component-tests.setup';

describe('React Cypress Component Tests - library usage', () => {
  const context = setupReactCypressSuite();

  afterAll(() => teardownReactCypressSuite());

  it('should successfully component test lib being used in app', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${context.usedInAppLibName} --generate-tests`
    );
    if (runE2ETests()) {
      expect(
        runCLI(`component-test ${context.usedInAppLibName} --no-watch`)
      ).toContain('All specs passed!');
    }
  }, 300_000);
});

