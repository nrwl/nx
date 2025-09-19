import {
  cleanupProject,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e-utils';

describe('React Cypress Component Tests - lib used in app', () => {
  beforeAll(async () => {
    newProject({ name: uniq('cy-react'), packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it('should successfully component test lib being used in app', () => {
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
    if (runE2ETests()) {
      expect(runCLI(`component-test ${libName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
