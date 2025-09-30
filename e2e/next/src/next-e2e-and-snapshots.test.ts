import {
  getStrippedEnvironmentVariables,
  readFile,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e-utils';
import {
  setupNextTest,
  resetNextEnv,
  cleanupNextTest,
  NextTestSetup,
} from './next-setup';

describe('Next.js Applications - E2E and Snapshots', () => {
  let setup: NextTestSetup;

  beforeAll(() => {
    setup = setupNextTest();
  });

  beforeEach(() => {
    resetNextEnv(setup);
  });

  afterEach(() => {
    resetNextEnv(setup);
  });

  afterAll(() => cleanupNextTest());

  it('should run e2e-ci test', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/next:app ${appName} --no-interactive --style=css --linter=eslint --unitTestRunner=jest`
    );

    if (runE2ETests('playwright')) {
      const e2eResults = runCLI(`e2e-ci ${appName}-e2e --verbose`, {
        verbose: true,
        env: {
          ...getStrippedEnvironmentVariables(),
          NX_SKIP_ATOMIZER_VALIDATION: 'true',
        },
      });
      expect(e2eResults).toContain(
        'Successfully ran target e2e-ci for project'
      );
    }
  }, 600_000);

  it('next-env.d.ts should remain the same after a build', async () => {
    const appName = uniq('app');
    const pagesAppName = uniq('pages-app');

    runCLI(
      `generate @nx/next:app ${appName} --style=css --no-interactive --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/next:app ${pagesAppName} --appDir=false --style=css --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    const appDirNextEnv = `${appName}/next-env.d.ts`;
    const appDirNextEnvContent = readFile(appDirNextEnv);

    const pagesDirNextEnv = `${pagesAppName}/next-env.d.ts`;
    const pagesDirNextEnvContent = readFile(pagesDirNextEnv);

    runCLI(`build ${appName}`);
    runCLI(`build ${pagesAppName}`);

    const postBuildAppContent = readFile(appDirNextEnv);
    const postBuildPagesContent = readFile(pagesDirNextEnv);

    expect(postBuildAppContent).toEqual(appDirNextEnvContent);
    expect(postBuildAppContent).toMatchSnapshot();

    expect(postBuildPagesContent).toEqual(pagesDirNextEnvContent);
    expect(postBuildPagesContent).toMatchSnapshot();
  });
});
