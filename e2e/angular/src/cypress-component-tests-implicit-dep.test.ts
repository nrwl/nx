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
  updateTestToAssertTailwindIsNotApplied,
  useBuildableLibInLib,
  updateBuilableLibTestsToAssertAppStyles,
  CypressComponentTestsSetup,
} from './cypress-component-tests-setup';

describe('Angular Cypress Component Tests - Implicit Dep', () => {
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

    // Setup cypress component testing for the buildable lib
    // This is needed for the tests in this file to work
    const { appName, buildableLibName } = setup;
    updateTestToAssertTailwindIsNotApplied(buildableLibName);
    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build --no-interactive`
    );
  });

  afterAll(() => cleanupCypressComponentTests());

  // TODO(jack): re-enable when lodash@4.18.0 assignWith bug is resolved
  it.skip('should test lib with implicit dep on buildTarget', () => {
    const { projectName, appName, buildableLibName, usedInAppLibName } = setup;

    // creates graph like buildableLib -> lib -> app
    // updates the apps styles and they should apply to the buildableLib
    // even though app is not directly connected to buildableLib
    useBuildableLibInLib(projectName, buildableLibName, usedInAppLibName);

    updateBuilableLibTestsToAssertAppStyles(appName, buildableLibName);

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });
});
