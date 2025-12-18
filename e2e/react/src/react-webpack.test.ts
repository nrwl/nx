import {
  cleanupProject,
  createFile,
  killPorts,
  listFiles,
  newProject,
  readFile,
  runCLI,
  runCLIAsync,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Build React applications and libraries with Webpack', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/react'],
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should generate app with custom port', async () => {
    const appName = uniq('app');
    const customPort = 8081;

    runCLI(
      `generate @nx/react:app apps/${appName} --bundler=webpack --port=${customPort} --unitTestRunner=none --no-interactive --e2eTestRunner=playwright`
    );

    const webpackConfig = readFile(`apps/${appName}/webpack.config.js`);
    expect(webpackConfig).toContain(`port: ${customPort}`);

    if (runE2ETests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`, {
        verbose: true,
      });
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      expect(await killPorts()).toBeTruthy();
    }
  }, 300_000);
});
