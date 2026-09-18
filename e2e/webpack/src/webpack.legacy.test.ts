import {
  checkFilesExist,
  cleanupProject,
  fileExists,
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
  it('should allow main/styles entries to be spread after native plugins apply (#20179)', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler webpack --unitTestRunner=jest --linter=eslint`
    );

    checkFilesExist(`${appName}/src/main.ts`);
    updateFile(`${appName}/src/main.ts`, `console.log('Hello');\n`);

    updateFile(
      `${appName}/webpack.config.js`,
      `
        const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        module.exports = {
          output: { clean: true },
          plugins: [
            new NxAppWebpackPlugin(),
            {
              apply(compiler) {
                const { main, styles } = compiler.options.entry;
                compiler.options.entry = {
                  main: { ...main, import: [...main.import] },
                  styles: { ...styles, import: [...styles.import] },
                };
              },
            },
          ],
        };
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
    runCLI(
      `generate @nx/web:app ${appName} --bundler webpack --e2eTestRunner=playwright --unitTestRunner=jest --linter=eslint`
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

  describe('convert-config-to-webpack-plugin', () => {
    it('should leave a generated native config unchanged when no conversion is needed', async () => {
      const appName = uniq('app');
      runCLI(
        `generate @nx/web:app ${appName} --bundler webpack --e2eTestRunner=playwright --unitTestRunner=vitest --linter=eslint`
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

      const webpackConfig = readFile(`${appName}/webpack.config.js`);
      const projectJSON = readFile(`${appName}/project.json`);
      expect(webpackConfig).toContain('NxAppWebpackPlugin');
      const conversionOutput = runCLI(
        `generate @nx/webpack:convert-config-to-webpack-plugin --project ${appName}`,
        { silenceError: true }
      );
      expect(runCLI.lastExitCode).not.toBe(0);
      expect(conversionOutput).toContain(
        'Could not find any projects to migrate.'
      );
      expect(readFile(`${appName}/webpack.config.js`)).toBe(webpackConfig);
      expect(readFile(`${appName}/project.json`)).toBe(projectJSON);
      expect(fileExists(`${appName}/webpack.config.old.js`)).toBe(false);

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
