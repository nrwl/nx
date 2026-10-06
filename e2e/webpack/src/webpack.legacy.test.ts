import {
  checkFilesExist,
  cleanupProject,
  killProcessAndPorts,
  newProject,
  readFile,
  reservePort,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  shouldRunPlaywrightTests,
} from '@nx/e2e-utils';
import { ChildProcess } from 'child_process';

describe('Webpack Plugin (legacy)', () => {
  let originalAddPluginsEnv: string | undefined;
  const appName = uniq('app');
  const libName = uniq('lib');

  beforeAll(() => {
    originalAddPluginsEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    newProject({
      packages: [
        '@nx/react',
        '@nx/webpack',
        '@nx/cypress',
        '@nx/playwright',
        '@nx/jest',
        '@nx/vite',
        '@nx/vitest',
        '@nx/eslint',
      ],
    });
    runCLI(
      `generate @nx/react:app ${appName} --bundler webpack --e2eTestRunner=cypress --rootProject --no-interactive --unitTestRunner=jest --linter=eslint`
    );
    runCLI(
      `generate @nx/react:lib ${libName} --unitTestRunner jest --no-interactive --linter=eslint`
    );
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalAddPluginsEnv;
    cleanupProject();
  });

  it('should generate, build, and serve React applications and libraries', () => {
    expect(() => runCLI(`test ${appName}`)).not.toThrow();
    expect(() => runCLI(`test ${libName}`)).not.toThrow();

    // TODO: figure out why this test hangs in CI (maybe down to sudo prompt?)
    // expect(() => runCLI(`build ${appName}`)).not.toThrow();

    // if (await shouldRunCypressTests()) {
    //   runCLI(`e2e ${appName}-e2e --watch=false --verbose`);
    // }
  }, 500_000);

  it('should run serve-static', async () => {
    let process: ChildProcess;
    const port = await reservePort();

    try {
      process = await runCommandUntil(
        `serve-static ${appName} --port=${port}`,
        (output) => {
          return output.includes(`http://localhost:${port}`);
        }
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    if (process && process.pid) {
      await killProcessAndPorts(process.pid, port);
    }
  });

  // Issue: https://github.com/nrwl/nx/issues/20179
  it('should allow main/styles entries to be spread within composePlugins() function (#20179)', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler webpack --unitTestRunner=jest --linter=eslint`
    );

    checkFilesExist(`${appName}/src/main.ts`);
    updateFile(`${appName}/src/main.ts`, `console.log('Hello');\n`);

    updateFile(
      `${appName}/webpack.config.js`,
      `
        const { composePlugins, withNx, withWeb } = require('@nx/webpack');
        module.exports = composePlugins(withNx(), withWeb(), (config) => {
        config.output.clean = true;
          return {
            ...config,
            entry: {
              main: [...config.entry.main],
              styles: [...config.entry.styles],
            }
          };
        });
      `
    );

    expect(() => {
      runCLI(`build ${appName} --outputHashing none`);
    }).not.toThrow();
    checkFilesExist(`dist/${appName}/styles.css`);

    expect(() => {
      runCLI(`build ${appName} --outputHashing none --extractCss false`);
    }).not.toThrow();
    expect(() => {
      checkFilesExist(`dist/${appName}/styles.css`);
    }).toThrow();
  });

  it('should support standard webpack config with executors', async () => {
    const appName = uniq('app');
    // Reserved so a parallel suite serving the default 4200 cannot answer the
    // e2e run: the generated Playwright config reuses any server on its URL.
    const port = await reservePort();
    runCLI(
      `generate @nx/web:app ${appName} --bundler webpack --e2eTestRunner=playwright --unitTestRunner=jest --linter=eslint --port=${port}`
    );
    updateFile(
      `${appName}/src/main.ts`,
      `
      document.querySelector('proj-root')!.innerHTML = '<h1>Welcome</h1>';
    `
    );
    updateFile(
      `${appName}/webpack.config.js`,
      `
      const { join } = require('path');
        const {NxAppWebpackPlugin} = require('@nx/webpack/app-plugin');
        module.exports = {
          output: {
            path: join(__dirname, '../dist/${appName}'),
          },
          plugins: [
            new NxAppWebpackPlugin({
              main: './src/main.ts',
              compiler: 'tsc',
              index: './src/index.html',
              tsConfig: './tsconfig.app.json',
            })
          ]
        };
      `
    );

    expect(() => {
      runCLI(`build ${appName} --outputHashing none`);
    }).not.toThrow();

    if (await shouldRunPlaywrightTests()) {
      expect(() => {
        runCLI(`e2e ${appName}-e2e`);
      }).not.toThrow();
    }
  });

  describe('ConvertConfigToWebpackPlugin,', () => {
    it('should convert withNx webpack config to a standard config using NxWebpackPlugin', async () => {
      const appName = 'app3224373'; // Needs to be reserved so that the snapshot projectName matches
      const port = await reservePort();
      runCLI(
        `generate @nx/web:app ${appName} --bundler webpack --e2eTestRunner=playwright --unitTestRunner=vitest --linter=eslint --port=${port}`
      );
      updateFile(
        `${appName}/src/main.ts`,
        `
      const root = document.querySelector('proj-root');
      if(root) {
        root.innerHTML = '<h1>Welcome</h1>'
      }
    `
      );

      runCLI(
        `generate @nx/webpack:convert-config-to-webpack-plugin --project ${appName}`
      );

      // The reserved port differs per run; keep it out of the snapshots.
      const withoutPort = (contents: string) =>
        contents.replace(new RegExp(`\\b${port}\\b`, 'g'), '<port>');
      const webpackConfig = withoutPort(
        readFile(`${appName}/webpack.config.js`)
      );
      const oldWebpackConfig = withoutPort(
        readFile(`${appName}/webpack.config.old.js`)
      );
      const projectJSON = withoutPort(readFile(`${appName}/project.json`));

      expect(webpackConfig).toMatchSnapshot();
      expect(projectJSON).toMatchSnapshot(); // This file should be updated adding standardWebpackConfigFunction: true

      expect(oldWebpackConfig).toMatchSnapshot(); // This file should be renamed and updated to not include `withNx`, `withReact`, and `withWeb`.

      expect(() => {
        runCLI(`build ${appName}`);
      }).not.toThrow();

      if (await shouldRunPlaywrightTests()) {
        expect(() => {
          runCLI(`e2e ${appName}-e2e`);
        }).not.toThrow();
      }
    }, 600_000);
  });
});
