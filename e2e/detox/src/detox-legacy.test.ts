import {
  checkFilesExist,
  isOSX,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  killPorts,
  cleanupProject,
} from '@nx/e2e-utils';

describe('@nx/detox (legacy)', () => {
  const appName = uniq('myapp');
  let originalEnv: string;

  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    newProject({ packages: ['@nx/react-native', '@nx/expo'] });
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  it('should create files and run lint command for react-native apps', async () => {
    runCLI(
      `generate @nx/react-native:app apps/${appName} --e2eTestRunner=detox --linter=eslint --install=false`
    );
    checkFilesExist(`apps/${appName}-e2e/.detoxrc.json`);
    checkFilesExist(`apps/${appName}-e2e/tsconfig.json`);
    checkFilesExist(`apps/${appName}-e2e/tsconfig.e2e.json`);
    checkFilesExist(`apps/${appName}-e2e/test-setup.ts`);
    checkFilesExist(`apps/${appName}-e2e/src/app.spec.ts`);

    const lintResults = await runCLIAsync(`lint ${appName}-e2e`);
    expect(lintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );
  });

  it('should support generating projects with the new name and root format', async () => {
    const appName = uniq('app1');

    runCLI(
      `generate @nx/react-native:app ${appName} --e2eTestRunner=detox --linter=eslint --install=false --interactive=false`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(
      `${appName}-e2e/.detoxrc.json`,
      `${appName}-e2e/tsconfig.json`,
      `${appName}-e2e/tsconfig.e2e.json`,
      `${appName}-e2e/test-setup.ts`,
      `${appName}-e2e/src/app.spec.ts`
    );

    const lintResults = await runCLIAsync(`lint ${appName}-e2e`);
    expect(lintResults.combinedOutput).toContain(
      'Successfully ran target lint'
    );
  });
});
