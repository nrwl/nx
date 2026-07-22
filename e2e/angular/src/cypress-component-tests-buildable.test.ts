import { runCLI, runE2ETests } from '@nx/e2e-utils';
import {
  setupCypressComponentTests,
  cleanupCypressComponentTests,
  updateTestToAssertTailwindIsNotApplied,
  CypressComponentTestsSetup,
} from './cypress-component-tests-setup';

describe('Angular Cypress Component Tests - Buildable Lib', () => {
  let setup: CypressComponentTestsSetup;

  beforeAll(async () => {
    setup = setupCypressComponentTests();
  });

  afterAll(() => cleanupCypressComponentTests());

  it('should test buildable lib not being used in app', () => {
    const { appName, buildableLibName } = setup;

    expect(() => {
      // should error since no edge in graph between lib and app
      runCLI(
        `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --no-interactive`
      );
    }).toThrow();

    updateTestToAssertTailwindIsNotApplied(buildableLibName);

    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
