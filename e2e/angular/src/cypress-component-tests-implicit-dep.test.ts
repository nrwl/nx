import {
  checkFilesDoNotExist,
  checkFilesExist,
  runCLI,
  runE2ETests,
} from '@nx/e2e-utils';
import { join } from 'path';
import {
  setupCypressComponentTests,
  cleanupCypressComponentTests,
  useBuildableLibInLib,
  updateBuilableLibTestsToAssertAppStyles,
  useRootLevelTailwindConfig,
  CypressComponentTestsSetup,
} from './cypress-component-tests-setup';

describe('Angular Cypress Component Tests - Implicit Dep', () => {
  let setup: CypressComponentTestsSetup;

  beforeAll(async () => {
    setup = setupCypressComponentTests();
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
