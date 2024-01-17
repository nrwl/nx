import {
  cleanupProject,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

describe('Webpack Plugin (PCv3)', () => {
  let originalPcv3: string | undefined;
  beforeAll(() => {
    originalPcv3 = process.env.NX_PCV3;
    process.env.NX_PCV3 = 'true';
    newProject({
      packages: ['@nx/react'],
      unsetProjectNameAndRootFormat: false,
    });
  });

  afterAll(() => {
    process.env.NX_PCV3 = originalPcv3;
    cleanupProject();
  });

  it('should generate, build, and serve React applications and libraries', () => {
    const appName = uniq('app');
    const libName = uniq('lib');
    runCLI(
      `generate @nx/react:app ${appName} --bundler webpack --e2eTestRunner=cypress --rootProject --no-interactive`
    );

    expect(() => runCLI(`test ${appName}`)).not.toThrow();

    runCLI(
      `generate @nx/react:lib ${libName} --unitTestRunner jest --no-interactive`
    );

    expect(() => runCLI(`test ${appName}`)).not.toThrow();
    expect(() => runCLI(`test ${libName}`)).not.toThrow();

    // TODO: figure out why this test hangs in CI (maybe down to sudo prompt?)
    // expect(() => runCLI(`build ${appName}`)).not.toThrow();

    // if (runE2ETests()) {
    //   runCLI(`e2e ${appName}-e2e --watch=false --verbose`);
    // }
  }, 500_000);
});
