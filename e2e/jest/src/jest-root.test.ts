import { newProject, runCLI, runCLIAsync, uniq } from '@nx/e2e/utils';

describe('Jest root projects', () => {
  const myapp = uniq('myapp');
  const mylib = uniq('mylib');

  describe('angular', () => {
    beforeAll(() => {
      newProject({
        packages: ['@nx/angular'],
        unsetProjectNameAndRootFormat: false,
      });
      runCLI(
        `generate @nx/angular:app ${myapp} --directory . --rootProject --projectNameAndRootFormat as-provided --no-interactive`
      );
    });

    it('should test root level app projects', async () => {
      const rootProjectTestResults = await runCLIAsync(`test ${myapp}`);
      expect(rootProjectTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 300_000);

    it('should add lib project and tests should still work', async () => {
      runCLI(
        `generate @nx/angular:lib ${mylib} --projectNameAndRootFormat as-provided --no-interactive`
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
      newProject({
        packages: ['@nx/react'],
        unsetProjectNameAndRootFormat: false,
      });
      runCLI(
        `generate @nx/react:app ${myapp} --directory . --rootProject --projectNameAndRootFormat as-provided`
      );
    });

    it('should test root level app projects', async () => {
      const rootProjectTestResults = await runCLIAsync(`test ${myapp}`);

      expect(rootProjectTestResults.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 300_000);

    it('should add lib project and tests should still work', async () => {
      runCLI(
        `generate @nx/react:lib ${mylib} --unitTestRunner=jest --projectNameAndRootFormat as-provided`
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
});
