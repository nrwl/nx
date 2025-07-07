import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  readFile,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('Build React applications and libraries with Rspack', () => {
  let proj: string;
  beforeAll(() => {
    proj = newProject({
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
      `generate @nx/react:app ${appName} --bundler=rspack --port=${customPort} --unit-test-runner=vitest --no-interactive --skipFormat --linter=eslint --e2eTestRunner=playwright`
    );

    const rspackConfig = readFile(`${appName}/rspack.config.js`);
    expect(rspackConfig).toContain(`port: ${customPort}`);

    if (runE2ETests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`, {
        verbose: true,
      });
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      expect(await killPorts()).toBeTruthy();
    }
  }, 300_000);

  it('should be able to use Rspack to build and test apps', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(
      `generate @nx/react:app ${appName} --bundler=rspack --unit-test-runner=vitest --no-interactive --skipFormat --linter=eslint`
    );
    runCLI(
      `generate @nx/react:lib ${libName} --bundler=none --no-interactive --unit-test-runner=vitest --skipFormat --linter=eslint`
    );

    // Library generated with Vite
    checkFilesExist(`${libName}/vite.config.ts`);

    const mainPath = `${appName}/src/main.tsx`;
    updateFile(
      mainPath,
      `
          import '@${proj}/${libName}';
          ${readFile(mainPath)}
        `
    );

    runCLI(`build ${appName}`, { verbose: true });

    checkFilesExist(`dist/${appName}/index.html`);

    if (runE2ETests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`, {
        verbose: true,
      });
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      expect(await killPorts()).toBeTruthy();
    }
  }, 250_000);
});
