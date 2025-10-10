import { cleanupProject, runCLI, runE2ETests } from '@nx/e2e-utils';
import { setupCypressComponentTests } from './cypress-component-tests-setup';

describe('React Cypress Component Tests - app', () => {
  let projectName;
  let appName;

  beforeAll(async () => {
    const setup = setupCypressComponentTests();
    projectName = setup.projectName;
    appName = setup.appName;
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

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
