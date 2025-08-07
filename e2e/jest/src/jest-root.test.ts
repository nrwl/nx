import { newProject, runCLI, runCLIAsync, uniq } from '@nx/e2e-utils';

describe('Jest root projects', () => {
  const myapp = uniq('myapp');
  const mylib = uniq('mylib');

  describe('angular', () => {
    beforeAll(() => {
      newProject({
        packages: ['@nx/angular'],
      });
      runCLI(
        `generate @nx/angular:app --name=${myapp} --directory . --rootProject --no-interactive --unitTestRunner=jest --linter=eslint`
      );
    });

    it('should test root level app projects', async () => {
      expect(() => runCLI(`test ${myapp}`)).not.toThrow();
    }, 300_000);

    it('should add lib project and tests should still work', async () => {
      runCLI(
        `generate @nx/angular:lib ${mylib} --no-interactive --unitTestRunner=jest --linter=eslint`
      );

      expect(() => runCLI(`test ${mylib}`)).not.toThrow();
      expect(() => runCLI(`test ${myapp}`)).not.toThrow();
    }, 300_000);
  });

  describe('react', () => {
    beforeAll(() => {
      newProject({
        packages: ['@nx/react'],
      });
      runCLI(
        `generate @nx/react:app --name=${myapp} --directory . --rootProject --unitTestRunner=jest --linter=eslint`
      );
    });

    it('should test root level app projects', async () => {
      expect(() => runCLI(`test ${myapp}`)).not.toThrow();
    }, 300_000);

    it('should add lib project and tests should still work', async () => {
      runCLI(
        `generate @nx/react:lib ${mylib} --unitTestRunner=jest --linter=eslint`
      );

      expect(() => runCLI(`test ${mylib}`)).not.toThrow();
      expect(() => runCLI(`test ${myapp}`)).not.toThrow();
    }, 300_000);
  });
});
