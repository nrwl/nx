import {
  checkFilesExist,
  killPorts,
  readJson,
  runCLI,
  runCLIAsync,
  runE2ETests,
} from '../../utils';

export async function checkApp(
  appName: string,
  opts: {
    checkUnitTest: boolean;
    checkLint: boolean;
    checkE2E: boolean;
    appsDir?: string;
  }
) {
  const appsDir = opts.appsDir ?? 'apps';

  if (opts.checkLint) {
    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting');
  }

  if (opts.checkUnitTest) {
    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }

  const buildResult = runCLI(`build ${appName}`);
  expect(buildResult).toContain(`Successfully ran target build`);
  checkFilesExist(`${appsDir}/${appName}/.next/build-manifest.json`);

  if (opts.checkE2E && runE2ETests()) {
    const e2eResults = runCLI(
      `e2e ${appName}-e2e --no-watch --configuration=production`
    );
    expect(e2eResults).toContain('Successfully ran target e2e for project');
    expect(await killPorts()).toBeTruthy();
  }
}
