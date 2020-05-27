import {
  checkFilesExist,
  ensureProject,
  forEachCli,
  readFile,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from './utils';

forEachCli((currentCLIName) => {
  describe('Web Components Applications', () => {
    it('should be able to generate a web app', async () => {
      ensureProject();
      const appName = uniq('app');

      const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';
      runCLI(
        `generate @nrwl/web:app ${appName} --no-interactive --linter=${linter}`
      );

      const lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain('All files pass linting.');

      runCLI(`build ${appName}`);
      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/polyfills.js`,
        `dist/apps/${appName}/main.js`,
        `dist/apps/${appName}/styles.js`
      );
      expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
        'class AppElement'
      );
      runCLI(`build ${appName} --prod --output-hashing none`);
      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/polyfills.esm.js`,
        `dist/apps/${appName}/main.esm.js`,
        `dist/apps/${appName}/polyfills.es5.js`,
        `dist/apps/${appName}/main.es5.js`,
        `dist/apps/${appName}/styles.css`
      );
      expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
        `<link rel="stylesheet" href="styles.css">`
      );
      const testResults = await runCLIAsync(`test ${appName}`);
      expect(testResults.stderr).toContain('Test Suites: 1 passed, 1 total');
      const lintE2eResults = runCLI(`lint ${appName}-e2e`);
      expect(lintE2eResults).toContain('All files pass linting.');

      const e2eResults = runCLI(`e2e ${appName}-e2e`);
      expect(e2eResults).toContain('All specs passed!');
    }, 120000);
  });

  describe('CLI - Environment Variables', () => {
    it('should support NX environment variables', () => {
      ensureProject();

      const appName = uniq('app');
      const main = `apps/${appName}/src/main.ts`;
      const newCode = `const envVars = [process.env.NODE_ENV, process.env.NX_BUILD, process.env.NX_API];`;

      runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

      const content = readFile(main);

      updateFile(main, `${newCode}\n${content}`);

      runCLI(`build ${appName}`, {
        env: { ...process.env, NODE_ENV: 'test', NX_BUILD: '52', NX_API: 'QA' },
      });
      expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
        'envVars = ["test", "52", "QA"];'
      );
    });
  });
});
