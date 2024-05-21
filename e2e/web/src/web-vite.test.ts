import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  isNotWindows,
  killPorts,
  newProject,
  runCLI,
  runCLIAsync,
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

describe('Web Components Applications with bundler set as vite', () => {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());

  it('should be able to generate a web app', async () => {
    const appName = uniq('app');
    runCLI(`generate @nx/web:app ${appName} --bundler=vite --no-interactive`);

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('Successfully ran target lint');

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/apps/${appName}/index.html`);

    const testResults = await runCLIAsync(`test ${appName}`);

    expect(testResults.combinedOutput).toContain(`PASS ${appName}`);

    const lintE2eResults = runCLI(`lint ${appName}-e2e`);

    expect(lintE2eResults).toContain('Successfully ran target lint');

    if (isNotWindows() && runE2ETests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      await killPorts();
    }
  }, 500000);

  it('should remove previous output before building', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nx/web:app ${appName} --bundler=vite --no-interactive`);
    runCLI(
      `generate @nx/react:lib ${libName} --bundler=vite --no-interactive --unitTestRunner=vitest`
    );

    createFile(`dist/apps/${appName}/_should_remove.txt`);
    createFile(`dist/libs/${libName}/_should_remove.txt`);
    createFile(`dist/apps/_should_not_remove.txt`);
    checkFilesExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/apps/_should_not_remove.txt`
    );
    runCLI(`build ${appName} --emptyOutDir`);
    runCLI(`build ${libName} --emptyOutDir`);
    checkFilesDoNotExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/libs/${libName}/_should_remove.txt`
    );
    checkFilesExist(`dist/apps/_should_not_remove.txt`);
  }, 120000);
});
