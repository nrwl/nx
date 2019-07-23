import {
  checkFilesExist,
  ensureProject,
  readFile,
  runCLI,
  runCLIAsync,
  uniq,
  forEachCli,
  supportUi
} from './utils';

forEachCli(() => {
  describe('Web Components Applications', () => {
    it('should be able to generate a web app', async () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

      const lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain('All files pass linting.');

      runCLI(`build ${appName}`);
      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/polyfills-es2015.js`,
        `dist/apps/${appName}/runtime-es2015.js`,
        `dist/apps/${appName}/main-es2015.js`,
        `dist/apps/${appName}/styles-es2015.js`,
        `dist/apps/${appName}/polyfills-es5.js`,
        `dist/apps/${appName}/runtime-es5.js`,
        `dist/apps/${appName}/main-es5.js`,
        `dist/apps/${appName}/styles-es5.js`
      );
      expect(readFile(`dist/apps/${appName}/main-es5.js`)).toContain(
        'var AppElement = /** @class */ (function (_super) {'
      );
      expect(readFile(`dist/apps/${appName}/main-es2015.js`)).toContain(
        'class AppElement'
      );
      runCLI(`build ${appName} --prod --output-hashing none`);
      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/polyfills-es2015.js`,
        `dist/apps/${appName}/runtime-es2015.js`,
        `dist/apps/${appName}/main-es2015.js`,
        `dist/apps/${appName}/polyfills-es5.js`,
        `dist/apps/${appName}/runtime-es5.js`,
        `dist/apps/${appName}/main-es5.js`,
        `dist/apps/${appName}/styles.css`
      );
      const testResults = await runCLIAsync(`test ${appName}`);
      expect(testResults.stderr).toContain('Test Suites: 1 passed, 1 total');
      const lintE2eResults = runCLI(`lint ${appName}-e2e`);
      expect(lintE2eResults).toContain('All files pass linting.');
      const e2eResults = runCLI(`e2e ${appName}-e2e`);
      expect(e2eResults).toContain('All specs passed!');
    }, 120000);
  });
});
