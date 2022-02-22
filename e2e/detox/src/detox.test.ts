import {
  checkFilesExist,
  isOSX,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  killPorts,
} from '@nrwl/e2e/utils';

describe('Detox', () => {
  const appName = uniq('myapp');

  beforeAll(() => {
    newProject();
    runCLI(
      `generate @nrwl/react-native:app ${appName} --e2eTestRunner=detox --linter=eslint`
    );
  });

  it('should create files and run lint command', async () => {
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
        expect(runCLI(`build-ios ${appName}-e2e`)).toContain(
          'Successfully ran target build-ios'
        );

        expect(
          runCLI(
            `test-ios ${appName}-e2e --debugSynchronization=true --loglevel=trace`
          )
        ).toContain('Successfully ran target test-ios');

        await killPorts(8081); // kill the port for the serve command
      }, 3000000);
    }
  });
});
