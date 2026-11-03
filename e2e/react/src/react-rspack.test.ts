import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  packageInstall,
  readFile,
  reservePort,
  runCLI,
  uniq,
  updateFile,
  shouldRunPlaywrightTests,
} from '@nx/e2e-utils';

describe('Build React applications and libraries with Rspack', () => {
  let proj: string;
  beforeAll(() => {
    proj = newProject({
      packages: [
        '@nx/react',
        '@nx/rspack',
        '@nx/vite',
        '@nx/vitest',
        '@nx/eslint',
        '@nx/playwright',
      ],
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should generate app with custom port', async () => {
    const appName = uniq('app');
    const customPort = await reservePort();

    runCLI(
      `generate @nx/react:app ${appName} --bundler=rspack --port=${customPort} --unit-test-runner=vitest --no-interactive --skipFormat --linter=eslint --e2eTestRunner=playwright`
    );

    const rspackConfig = readFile(`${appName}/rspack.config.js`);
    expect(rspackConfig).toContain(`port: ${customPort}`);

    if (await shouldRunPlaywrightTests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`, {
        verbose: true,
      });
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      expect(await killPorts(customPort)).toBeTruthy();
    }
  }, 300_000);

  it('should be able to use Rspack to build and test apps', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');
    const port = await reservePort();

    runCLI(
      `generate @nx/react:app ${appName} --bundler=rspack --port=${port} --unit-test-runner=vitest --no-interactive --skipFormat --linter=eslint`
    );
    runCLI(
      `generate @nx/react:lib ${libName} --bundler=none --no-interactive --unit-test-runner=vitest --skipFormat --linter=eslint`
    );

    // Library generated with Vite
    checkFilesExist(`${libName}/vite.config.mts`);

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

    if (await shouldRunPlaywrightTests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`, {
        verbose: true,
      });
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      expect(await killPorts(port)).toBeTruthy();
    }
  }, 250_000);

  it('should extract licenses for apps using Module Federation', () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/react:app ${appName} --bundler=rspack --unit-test-runner=none --e2eTestRunner=none --useProjectJson=false --no-interactive --skipFormat --linter=none`
    );
    // The crash needs a package.json at the project root, which rspack runs from.
    checkFilesExist(`${appName}/package.json`);
    packageInstall('@module-federation/enhanced', undefined, '^2.4.0');

    const configPath = `${appName}/rspack.config.js`;
    updateFile(
      configPath,
      readFile(configPath)
        .replace(
          "const { join } = require('path');",
          "const { join } = require('path');\nconst { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');"
        )
        .replace(
          'new NxAppRspackPlugin({',
          'new NxAppRspackPlugin({\n      extractLicenses: true,'
        )
        .replace(
          'new NxReactRspackPlugin(),',
          `new NxReactRspackPlugin(),\n    new ModuleFederationPlugin({ name: '${appName.replace(/-/g, '_')}', filename: 'remoteEntry.js' }),`
        )
    );

    runCLI(`build ${appName}`, { env: { NODE_ENV: 'production' } });

    expect(readFile(`dist/${appName}/3rdpartylicenses.txt`)).toContain(
      '@module-federation/runtime'
    );
  }, 300_000);
});
