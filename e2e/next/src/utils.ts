import {
  checkFilesExist,
  killPorts,
  readJson,
  runCLI,
  runCLIAsync,
  runCypressTests,
} from '../../utils';

export async function checkApp(
  appName: string,
  opts: {
    checkUnitTest: boolean;
    checkLint: boolean;
    checkE2E: boolean;
    checkExport: boolean;
  }
) {
  const buildResult = runCLI(`build ${appName}`);
  expect(buildResult).toContain(`Compiled successfully`);
  checkFilesExist(`dist/apps/${appName}/.next/build-manifest.json`);

  const packageJson = readJson(`dist/apps/${appName}/package.json`);
  expect(packageJson.dependencies.react).toBeDefined();
  expect(packageJson.dependencies['react-dom']).toBeDefined();
  expect(packageJson.dependencies.next).toBeDefined();

  if (opts.checkLint) {
    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting.');
  }

  if (opts.checkUnitTest) {
    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }

  if (opts.checkE2E && runCypressTests()) {
    const e2eResults = runCLI(`e2e ${appName}-e2e --no-watch`);
    expect(e2eResults).toContain('All specs passed!');
    expect(await killPorts()).toBeTruthy();
  }

  if (opts.checkExport) {
    runCLI(`export ${appName}`);
    checkFilesExist(`dist/apps/${appName}/exported/index.html`);
  }
}
