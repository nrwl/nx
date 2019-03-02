import {
  ensureProject,
  runCLI,
  uniq,
  newApp,
  newLib,
  updateFile,
  readFile,
  runCLIAsync,
  checkFilesExist
} from '../utils';

describe('Web Applications', () => {
  it('should be able to generate a react application', async () => {
    ensureProject();
    const appName = uniq('app');
    const libName = uniq('lib');

    newApp(`${appName} --framework react`);
    newLib(`${libName} --framework none`);

    const mainPath = `apps/${appName}/src/main.tsx`;
    updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting.');
    runCLI(`build ${appName}`);
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/polyfills.js`,
      `dist/apps/${appName}/runtime.js`,
      `dist/apps/${appName}/vendor.js`,
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
    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.stderr).toContain('Test Suites: 1 passed, 1 total');
    const lintE2eResults = runCLI(`lint ${appName}-e2e`);
    expect(lintE2eResults).toContain('All files pass linting.');
    const e2eResults = runCLI(`e2e ${appName}-e2e`);
    expect(e2eResults).toContain('All specs passed!');
  }, 30000);

  it('should be able to generate a web-components application', async () => {
    ensureProject();
    const appName = uniq('app');
    const libName = uniq('lib');

    newApp(`${appName} --framework web-components`);
    newLib(`${libName} --framework none`);

    const mainPath = `apps/${appName}/src/main.ts`;
    updateFile(mainPath, `import '@proj/${libName}';\n` + readFile(mainPath));

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
    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.stderr).toContain('Test Suites: 1 passed, 1 total');
    const lintE2eResults = runCLI(`lint ${appName}-e2e`);
    expect(lintE2eResults).toContain('All files pass linting.');
    const e2eResults = runCLI(`e2e ${appName}-e2e`);
    expect(e2eResults).toContain('All specs passed!');
  }, 30000);
});
