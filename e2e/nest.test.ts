import { ensureProject, forEachCli, runCLI, runCLIAsync, uniq } from './utils';

forEachCli(currentCLIName => {
  const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';

  describe('Nest Guard', () => {
    it('should generate a guard and spec file', async () => {
      ensureProject();
      const nestlib = uniq('nestlib');

      runCLI(`generate @nrwl/nest:lib ${nestlib}`);

      const nestguard = uniq('nestguard');

      runCLI(`generate @nrwl/nest:gu ${nestguard} --project=${nestlib}`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('All files pass linting.');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.stderr).toContain('Test Suites: 1 passed, 1 total');
    });
  });

  describe('Nest Middleware', () => {
    it('should generate a middleware and spec file', async () => {
      ensureProject();
      const nestlib = uniq('nestlib');

      runCLI(`generate @nrwl/nest:lib ${nestlib}`);

      const nestmiddleware = uniq('nestmiddleware');

      runCLI(
        `generate @nrwl/nest:middleware ${nestmiddleware} --project=${nestlib}`
      );

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('All files pass linting.');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.stderr).toContain('Test Suites: 1 passed, 1 total');
    });
  });

  describe('Nest Interceptor', () => {
    it('should generate a interceptor and spec file', async () => {
      ensureProject();
      const nestlib = uniq('nestlib');

      runCLI(`generate @nrwl/nest:lib ${nestlib}`);

      const nestinterceptor = uniq('nestinterceptor');

      runCLI(`generate @nrwl/nest:in ${nestinterceptor} --project=${nestlib}`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('All files pass linting.');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.stderr).toContain('Test Suites: 1 passed, 1 total');
    });
  });

  describe('Nest Pipe', () => {
    it('should generate a pipe and spec file', async () => {
      ensureProject();
      const nestlib = uniq('nestlib');

      runCLI(`generate @nrwl/nest:lib ${nestlib}`);

      const nestpipe = uniq('nestpipe');

      runCLI(`generate @nrwl/nest:pipe ${nestpipe} --project=${nestlib}`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('All files pass linting.');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.stderr).toContain('Test Suites: 1 passed, 1 total');
    });
  });
});
