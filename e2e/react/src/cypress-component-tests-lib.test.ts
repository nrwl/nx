import { cleanupProject, runCLI, runE2ETests, updateFile } from '@nx/e2e-utils';
import { setupCypressComponentTests } from './cypress-component-tests-setup';

describe('React Cypress Component Tests - lib used in app', () => {
  let projectName;
  let usedInAppLibName;

  beforeAll(async () => {
    const setup = setupCypressComponentTests();
    projectName = setup.projectName;
    usedInAppLibName = setup.usedInAppLibName;
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should successfully component test lib being used in app', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${usedInAppLibName} --generate-tests`
    );
    if (runE2ETests()) {
      expect(runCLI(`component-test ${usedInAppLibName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);

  it('should successfully component test lib being used in app using babel compiler', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${usedInAppLibName} --generate-tests`
    );
    updateFile(`libs/${usedInAppLibName}/cypress.config.ts`, (content) => {
      // apply babel compiler
      return content.replace(
        'nxComponentTestingPreset(__filename)',
        'nxComponentTestingPreset(__filename, {compiler: "babel"})'
      );
    });
    if (runE2ETests()) {
      expect(runCLI(`component-test ${usedInAppLibName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
