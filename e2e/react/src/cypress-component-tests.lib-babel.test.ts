import { runCLI, runE2ETests, updateFile } from '@nx/e2e-utils';

import {
  setupReactCypressSuite,
  teardownReactCypressSuite,
} from './cypress-component-tests.setup';

describe('React Cypress Component Tests - library babel compiler', () => {
  const context = setupReactCypressSuite();

  afterAll(() => teardownReactCypressSuite());

  it('should successfully component test lib being used in app using babel compiler', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${context.usedInAppLibName} --generate-tests`
    );
    updateFile(
      `libs/${context.usedInAppLibName}/cypress.config.ts`,
      (content) =>
        content.replace(
          'nxComponentTestingPreset(__filename)',
          'nxComponentTestingPreset(__filename, {compiler: "babel"})'
        )
    );
    if (runE2ETests()) {
      expect(
        runCLI(`component-test ${context.usedInAppLibName} --no-watch`)
      ).toContain('All specs passed!');
    }
  }, 300_000);
});
