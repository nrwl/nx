import { newProject, runCLI, runCLIAsync, uniq } from '@nx/e2e/utils';

describe('Jest root projects', () => {
  const myapp = uniq('myapp');
  const mylib = uniq('mylib');

  describe('angular', () => {
    beforeAll(() => {
      newProject();
    });

    it('should test root level app projects', async () => {
      runCLI(
        `generate @nx/angular:app ${myapp} --rootProject=true --no-interactive`
      );
      const rootProjectTestResults = await runCLIAsync(`test ${myapp}`);
      expect(rootProjectTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 300_000);

    it('should add lib project and tests should still work', async () => {
      runCLI(`generate @nx/angular:lib ${mylib} --no-interactive`);
      runCLI(
        `generate @nx/angular:component ${mylib} --export --standalone --project=${mylib} --no-interactive`
      );

      const libProjectTestResults = await runCLIAsync(`test ${mylib}`);

      expect(libProjectTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );

      const rootProjectTestResults = await runCLIAsync(`test ${myapp}`);

      expect(rootProjectTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 300_000);
  });

  describe('react', () => {
    beforeAll(() => {
      newProject();
    });

    it('should test root level app projects', async () => {
      runCLI(`generate @nx/react:app ${myapp} --rootProject=true`);

      const rootProjectTestResults = await runCLIAsync(`test ${myapp}`);

      expect(rootProjectTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 300_000);

    it('should add lib project and tests should still work', async () => {
      runCLI(`generate @nx/react:lib ${mylib} --unitTestRunner=jest`);

      const libProjectTestResults = await runCLIAsync(`test ${mylib}`);

      expect(libProjectTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );

      const rootProjectTestResults = await runCLIAsync(`test ${myapp}`);

      expect(rootProjectTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 300_000);
  });
});
