import {
  checkFilesExist,
  exists,
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
    checkExport: boolean;
    appsDir?: string;
  }
) {
  const appsDir = opts.appsDir ?? 'apps';

  if (opts.checkLint) {
    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('Successfully ran target lint');
  }

  if (opts.checkUnitTest) {
    const testResults = await runCLIAsync(`test ${appName}`);
    expect(testResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }

  const buildResult = runCLI(`build ${appName}`);
  expect(buildResult).toContain(`Successfully ran target build`);
  // Executor will point to dist, whereas inferred build target will output to `<proj-root>/.next`
  try {
    checkFilesExist(`dist/${appsDir}/${appName}/.next/build-manifest.json`);
  } catch {
    checkFilesExist(`${appsDir}/${appName}/.next/build-manifest.json`);
  }

  // Only the executor will output package.json file to dist
  if (exists(`dist/${appsDir}/${appName}/package.json`)) {
    const packageJson = readJson(`dist/${appsDir}/${appName}/package.json`);
    expect(packageJson.dependencies.react).toBeDefined();
    expect(packageJson.dependencies['react-dom']).toBeDefined();
    expect(packageJson.dependencies.next).toBeDefined();
  }

  if (opts.checkE2E && runE2ETests()) {
    const e2eResults = runCLI(
      `e2e ${appName}-e2e --no-watch --configuration=production`
    );
    expect(e2eResults).toContain('Successfully ran target e2e for project');
    expect(await killPorts()).toBeTruthy();
  }
}
