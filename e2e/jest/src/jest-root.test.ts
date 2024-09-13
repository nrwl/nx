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
      expect(() => runCLI(`test ${myapp}`)).not.toThrow();
    }, 300_000);

    it('should add lib project and tests should still work', async () => {
      runCLI(
        `generate @nx/angular:lib ${mylib} --projectNameAndRootFormat as-provided --no-interactive`
      );

      expect(() => runCLI(`test ${mylib}`)).not.toThrow();
      expect(() => runCLI(`test ${myapp}`)).not.toThrow();
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
      expect(() => runCLI(`test ${myapp}`)).not.toThrow();
    }, 300_000);

    it('should add lib project and tests should still work', async () => {
      runCLI(
        `generate @nx/react:lib ${mylib} --unitTestRunner=jest --projectNameAndRootFormat as-provided`
      );

      expect(() => runCLI(`test ${mylib}`)).not.toThrow();
      expect(() => runCLI(`test ${myapp}`)).not.toThrow();
    }, 300_000);
  });
});
