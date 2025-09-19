import { cleanupProject, newProject, runCLI, runE2ETests, uniq, updateFile } from '@nx/e2e-utils';

describe('React Cypress Component Tests - babel compiler', () => {
  beforeAll(async () => {
    newProject({ name: uniq('cy-react'), packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it('should successfully component test lib being used in app using babel compiler', () => {
    const libName = uniq('cy-react-lib');
    runCLI(
      `generate @nx/react:lib libs/${libName} --no-interactive --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/react:component libs/${libName}/src/lib/btn/btn --export --no-interactive`
    );

    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${libName} --generate-tests`
    );
    updateFile(`libs/${libName}/cypress.config.ts`, (content) => {
      return content.replace(
        'nxComponentTestingPreset(__filename)',
        'nxComponentTestingPreset(__filename, {compiler: "babel"})'
      );
    });
    if (runE2ETests()) {
      expect(runCLI(`component-test ${libName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});


