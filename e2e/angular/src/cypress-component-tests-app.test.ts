import {
  getPackageManagerCommand,
  runCLI,
  runCommand,
  runE2ETests,
  updateJson,
} from '@nx/e2e-utils';
import {
  setupCypressComponentTests,
  cleanupCypressComponentTests,
  CypressComponentTestsSetup,
} from './cypress-component-tests-setup';

describe('Angular Cypress Component Tests - App', () => {
  let setup: CypressComponentTestsSetup;

  beforeAll(async () => {
    setup = setupCypressComponentTests();

    // Cypress CT (@cypress/vite-dev-server) does not support Vite 8 yet.
    // Downgrade the workspace to Vite 7 before configuring Cypress CT.
    updateJson('package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies['vite'] = '^7.0.0';
      json.devDependencies['@vitejs/plugin-react'] = '^4.2.0';
      return json;
    });
    runCommand(getPackageManagerCommand().install);
  });

  afterAll(() => cleanupCypressComponentTests());

  it('should test app', () => {
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
});
