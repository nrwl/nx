import {
  checkFilesDoNotExist,
  checkFilesExist,
  runCLI,
  runE2ETests,
  updateFile,
} from '@nx/e2e-utils';
import { join } from 'path';
import {
  setupCypressComponentTests,
  cleanupCypressComponentTests,
  updateTestToAssertTailwindIsNotApplied,
  useBuildableLibInLib,
  updateBuilableLibTestsToAssertAppStyles,
  useRootLevelTailwindConfig,
  CypressComponentTestsSetup,
} from './cypress-component-tests-setup';

describe('Angular Cypress Component Tests - Implicit Dep', () => {
  let setup: CypressComponentTestsSetup;

  beforeAll(async () => {
    setup = setupCypressComponentTests();

    // Setup cypress component testing for the buildable lib
    // This is needed for the tests in this file to work
    const { appName, buildableLibName } = setup;
    updateTestToAssertTailwindIsNotApplied(buildableLibName);
    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build --no-interactive`
    );

    // Add tailwind to the buildable lib
    runCLI(`generate @nx/angular:setup-tailwind --project=${buildableLibName}`);
    updateFile(
      `${buildableLibName}/src/lib/input/input.component.cy.ts`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );
    updateFile(
      `${buildableLibName}/src/lib/input-standalone/input-standalone.cy.ts`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );
  });

  afterAll(() => cleanupCypressComponentTests());

  it('should test lib with implicit dep on buildTarget', () => {
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

  it('should use root level tailwinds config', () => {
    const { buildableLibName } = setup;

    useRootLevelTailwindConfig(join(buildableLibName, 'tailwind.config.js'));
    checkFilesExist('tailwind.config.js');
    checkFilesDoNotExist(`${buildableLibName}/tailwind.config.js`);

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });
});
