import {
  checkFilesExist,
  ensureProject,
  runCLI,
  runCLIAsync,
  uniq
} from '../utils';

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
      `dist/apps/${appName}/polyfills.js`,
      `dist/apps/${appName}/runtime.js`,
      `dist/apps/${appName}/main.js`,
      `dist/apps/${appName}/styles.js`
    );
    runCLI(`build ${appName} --prod --output-hashing none`);
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/polyfills.js`,
      `dist/apps/${appName}/runtime.js`,
      `dist/apps/${appName}/main.js`,
      `dist/apps/${appName}/styles.css`
    );
    // const testResults = await runCLIAsync(`test ${appName}`);
    // expect(testResults.stderr).toContain('Test Suites: 1 passed, 1 total');
    const lintE2eResults = runCLI(`lint ${appName}-e2e`);
    expect(lintE2eResults).toContain('All files pass linting.');
    // const e2eResults = runCLI(`e2e ${appName}-e2e`);
    // expect(e2eResults).toContain('All specs passed!');
  }, 120000);
});
