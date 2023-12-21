import {
  cleanupProject,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

// TODO: figure out why this test hangs in CI
describe('Webpack Plugin (PCv3)', () => {
  let originalPcv3: string | undefined;
  beforeAll(() => {
    originalPcv3 = process.env.NX_PCV3;
    process.env.NX_PCV3 = 'true';
    newProject();
  });

  afterAll(() => {
    process.env.NX_PCV3 = originalPcv3;
    cleanupProject();
  });

  it('should generate, build, and serve React applications', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/react:app ${appName} --bundler webpack --e2eTestRunner=cypress --no-interactive`
    );

    expect(() => runCLI(`build ${appName}`)).not.toThrow();

    // if (runE2ETests()) {
    //   runCLI(`e2e ${appName}-e2e --watch=false --verbose`);
    // }
  }, 500_000);
});
