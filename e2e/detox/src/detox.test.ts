import {
  checkFilesExist,
  isOSX,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  getSelectedPackageManager,
  killPorts,
} from '@nrwl/e2e/utils';

describe('Detox', () => {
  beforeEach(() => newProject());

  it('should create files and run lint command', async () => {
    // currently react native does not support pnpm: https://github.com/pnpm/pnpm/issues/3321
    if (getSelectedPackageManager() === 'pnpm') return;
    const appName = uniq('myapp');
    runCLI(
      `generate @nrwl/react-native:app ${appName} --e2eTestRunner=detox --linter=eslint`
    );

    checkFilesExist(`apps/${appName}-e2e/.detoxrc.json`);
    checkFilesExist(`apps/${appName}-e2e/tsconfig.json`);
    checkFilesExist(`apps/${appName}-e2e/tsconfig.e2e.json`);
    checkFilesExist(`apps/${appName}-e2e/test-setup.ts`);
    checkFilesExist(`apps/${appName}-e2e/src/app.spec.ts`);

    const lintResults = await runCLIAsync(`lint ${appName}-e2e`);
    expect(lintResults.combinedOutput).toContain('All files pass linting');
  });

  describe('React Native Detox MACOS-Tests', () => {
    if (isOSX()) {
      it('should build and test ios MACOS-Tests', async () => {
        const appName = uniq('myapp');
        runCLI(
          `generate @nrwl/react-native:app ${appName} --e2eTestRunner=detox --linter=eslint`
        );

        expect(await runCLIAsync(`build-ios ${appName}-e2e`)).toContain(
          'Running target "build-ios" succeeded'
        );

        expect(await runCLIAsync(`build-ios ${appName}-e2e --pod`)).toContain(
          'Running target "build-ios" succeeded'
        );

        expect(
          await runCLIAsync(
            `test-ios ${appName}-e2e --prod --debugSynchronization=true --loglevel=trace`
          )
        ).toContain('Running target "test-ios" succeeded');

        await killPorts(8081); // kill the port for the serve command
      }, 1000000);
    }
  });
});
