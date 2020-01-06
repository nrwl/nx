import { forEachCli, ensureProject, uniq, runCLI, updateFile } from './utils';

forEachCli(currentCLIName => {
  const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';

  describe('Nx Plugin', () => {
    it('should be able to generate a Nx Plugin ', async done => {
      ensureProject();
      const plugin = uniq('plugin');

      runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter}`);
      const lintResults = runCLI(`lint ${plugin}`);
      expect(lintResults).toContain('All files pass linting.');

      const testResults = runCLI(`test ${plugin}`);
      expect(testResults).toContain('Test Suites: 2 passed, 2 total');
    });
  });
});
