import {
  checkFilesExist,
  cleanupProject,
  killProcessAndPorts,
  newProject,
  readFile,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { ChildProcess } from 'child_process';

describe('Webpack Plugin (legacy)', () => {
  let originalAddPluginsEnv: string | undefined;
  const appName = uniq('app');
  const libName = uniq('lib');

  beforeAll(() => {
    originalAddPluginsEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    newProject({
      packages: ['@nx/react'],
      unsetProjectNameAndRootFormat: false,
    });
    runCLI(
      `generate @nx/react:app ${appName} --bundler webpack --e2eTestRunner=cypress --rootProject --no-interactive`
    );
    runCLI(
      `generate @nx/react:lib ${libName} --unitTestRunner jest --no-interactive`
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

    // if (runE2ETests()) {
    //   runCLI(`e2e ${appName}-e2e --watch=false --verbose`);
    // }
  }, 500_000);

  it('should run serve-static', async () => {
    let process: ChildProcess;
    const port = 8081;

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
    runCLI(`generate @nx/web:app ${appName} --bundler webpack`);
    updateFile(`apps/${appName}/src/main.ts`, `console.log('Hello');\n`);

    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
        const { composePlugins, withNx, withWeb } = require('@nx/webpack');
        module.exports = composePlugins(withNx(), withWeb(), (config) => {
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

  it('should support standard webpack config with executors', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler webpack --e2eTestRunner=playwright`
    );
    updateFile(
      `${appName}/src/main.ts`,
      `
      document.querySelector('proj-root').innerHTML = '<h1>Welcome</h1>';
    `
    );
    updateFile(
      `${appName}/webpack.config.js`,
      `
      const { join } = require('path');
        const {NxWebpackPlugin} = require('@nx/webpack');
        module.exports = {
          output: {
            path: join(__dirname, '../dist/app9524918'),
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

    if (runE2ETests()) {
      expect(() => {
        runCLI(`e2e ${appName}-e2e`);
      }).not.toThrow();
    }
  });

  describe('ConvertConfigToWebpackPlugin,', () => {
    it('should convert withNx webpack config to a standard config using NxWebpackPlugin', () => {
      const appName = 'app3224373'; // Needs to be reserved so that the snapshot projectName matches
      runCLI(
        `generate @nx/web:app ${appName} --bundler webpack --e2eTestRunner=playwright --projectNameAndRootFormat=as-provided`
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

      const webpackConfig = readFile(`${appName}/webpack.config.js`);
      const oldWebpackConfig = readFile(`${appName}/webpack.config.old.js`);
      const projectJSON = readFile(`${appName}/project.json`);

      expect(webpackConfig).toMatchSnapshot();
      expect(projectJSON).toMatchSnapshot(); // This file should be updated adding standardWebpackConfigFunction: true

      expect(oldWebpackConfig).toMatchSnapshot(); // This file should be renamed and updated to not include `withNx`, `withReact`, and `withWeb`.

      expect(() => {
        runCLI(`build ${appName}`);
      }).not.toThrow();

      if (runE2ETests()) {
        expect(() => {
          runCLI(`e2e ${appName}-e2e`);
        }).not.toThrow();
      }
    }, 600_000);
  });
});
