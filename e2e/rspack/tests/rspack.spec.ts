import {
  checkFilesExist,
  cleanupProject,
  newProject,
  uniq,
  updateFile,
  runCLI,
  createFile,
  packageInstall,
  readJson,
  removeFile,
  updateJson,
} from '@nx/e2e-utils';

describe('rspack e2e', () => {
  let proj: string;

  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
    proj = newProject({ packages: ['@nx/rspack', '@nx/react'] });
  });
  afterAll(() => cleanupProject());

  it('should be inferred (crystal) by default', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/react:application --directory=apps/${appName} --bundler=rspack --e2eTestRunner=none`
    );

    const nxJSON = readJson('nx.json');
    const rspackPlugin = nxJSON.plugins.find(
      (plugin) => plugin.plugin === '@nx/rspack/plugin'
    );

    expect(rspackPlugin).toBeDefined();
  });

  it('should infer targets from a rspack.config.ts that imports @rspack/core and an extensionless .ts sibling', () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/react:application --directory=apps/${appName} --bundler=rspack --e2eTestRunner=none`
    );

    // The extensionless `.ts` import fails Node's native ESM link, so the
    // config falls back to swc-node (installed below) and re-requires
    // @rspack/core, which the failed link left cached (see #36685).
    packageInstall('@swc-node/register', undefined, '~1.11.1');
    packageInstall('@swc/core', undefined, '~1.15.5');
    removeFile(`apps/${appName}/rspack.config.js`);
    createFile(
      `apps/${appName}/rspack.shared.ts`,
      `export const devServerPort = 4310;`
    );
    createFile(
      `apps/${appName}/rspack.config.ts`,
      `
        import { NxAppRspackPlugin } from '@nx/rspack/app-plugin';
        import { NxReactRspackPlugin } from '@nx/rspack/react-plugin';
        import { CopyRspackPlugin } from '@rspack/core';
        import { join } from 'path';

        import { devServerPort } from './rspack.shared';

        export default {
          output: {
            path: join(__dirname, '../../dist/${appName}'),
          },
          devServer: {
            port: devServerPort,
          },
          plugins: [
            new NxAppRspackPlugin({
              tsConfig: './tsconfig.app.json',
              main: './src/main.tsx',
              index: './src/index.html',
              baseHref: '/',
              assets: ['./src/favicon.ico', './src/assets'],
              styles: ['./src/styles.scss'],
              outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
              optimization: process.env['NODE_ENV'] === 'production',
            }),
            new NxReactRspackPlugin(),
            new CopyRspackPlugin({ patterns: [] }),
          ],
        };`
    );

    const project = JSON.parse(
      runCLI(`show project ${appName} --json`, { daemon: false })
    );

    expect(project.targets.build).toBeDefined();
    expect(project.targets['serve-static'].options.port).toBe(4310);
  });

  describe('config types', () => {
    it('should support a standard config object', () => {
      const appName = uniq('app');

      runCLI(
        `generate @nx/react:application --directory=apps/${appName} --bundler=rspack --e2eTestRunner=none`
      );

      updateFile(
        `apps/${appName}/rspack.config.js`,
        `
          const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
          const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
          const { join } = require('path');
    
          module.exports = {
            output: {
              path: join(__dirname, '../../dist/${appName}'),
              // do not remove dist, so files between builds will remain
              clean: false,
            },
            devServer: {
              port: 4200,
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            plugins: [
              new NxAppRspackPlugin({
                tsConfig: './tsconfig.app.json',
                main: './src/main.tsx',
                index: './src/index.html',
                baseHref: '/',
                assets: ['./src/favicon.ico', './src/assets'],
                styles: ['./src/styles.scss'],
                outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
                optimization: process.env['NODE_ENV'] === 'production',
              }),
              new NxReactRspackPlugin({
                // Uncomment this line if you don't want to use SVGR
                // See: https://react-svgr.com/
                // svgr: false
              }),
            ],
          };`
      );

      const result = runCLI(`build ${appName}`);

      expect(result).toContain(
        `Successfully ran target build for project ${appName}`
      );

      // Ensure dist is not removed between builds since output.clean === false
      createFile(`dist/apps/${appName}/extra.js`);
      runCLI(`build ${appName} --skip-nx-cache`);
      checkFilesExist(`dist/apps/${appName}/extra.js`);
    });

    it('should support a standard function that returns a config object', () => {
      const appName = uniq('app');

      runCLI(
        `generate @nx/react:application --directory=apps/${appName} --bundler=rspack --e2eTestRunner=none`
      );

      updateFile(
        `apps/${appName}/rspack.config.js`,
        `
          const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
          const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
          const { join } = require('path');
    
          module.exports = () => {
            return {
            output: {
              path: join(__dirname, '../../dist/${appName}'),
            },
            devServer: {
              port: 4200,
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            plugins: [
              new NxAppRspackPlugin({
                tsConfig: './tsconfig.app.json',
                main: './src/main.tsx',
                index: './src/index.html',
                baseHref: '/',
                assets: ['./src/favicon.ico', './src/assets'],
                styles: ['./src/styles.scss'],
                outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
                optimization: process.env['NODE_ENV'] === 'production',
              }),
              new NxReactRspackPlugin({
                // Uncomment this line if you don't want to use SVGR
                // See: https://react-svgr.com/
                // svgr: false
              }),
            ],
          };
        };`
      );

      const result = runCLI(`build ${appName}`);
      expect(result).toContain(
        `Successfully ran target build for project ${appName}`
      );
    });

    it('should support an array of standard config objects', () => {
      const appName = uniq('app');
      const serverName = uniq('server');

      runCLI(
        `generate @nx/react:application --directory=apps/${appName} --bundler=rspack --e2eTestRunner=none`
      );

      // Create server index file
      createFile(
        `apps/${serverName}/index.js`,
        `console.log('Hello from ${serverName}');\n`
      );

      updateFile(
        `apps/${appName}/rspack.config.js`,
        `
          const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
          const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
          const { join } = require('path');
    
          module.exports = [
           {
            name: 'client',
            output: {
              path: join(__dirname, '../../dist/${appName}'),
            },
            devServer: {
              port: 4200,
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            plugins: [
              new NxAppRspackPlugin({
                tsConfig: './tsconfig.app.json',
                main: './src/main.tsx',
                index: './src/index.html',
                baseHref: '/',
                assets: ['./src/favicon.ico', './src/assets'],
                styles: ['./src/styles.scss'],
                outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
                optimization: process.env['NODE_ENV'] === 'production',
              }),
              new NxReactRspackPlugin({
                // Uncomment this line if you don't want to use SVGR
                // See: https://react-svgr.com/
                // svgr: false
              }),
            ],
          }, {
         name: 'server',
        target: 'node',
        entry: '../${serverName}/index.js',
        output: {
          path: join(__dirname, '../../dist/${serverName}'),
          filename: 'index.js',
        },
        }
        ];
        `
      );

      // NODE_ENV is stripped globally to prevent Jest's NODE_ENV=test from
      // leaking into subprocesses. Rspack multi-compiler builds need NODE_ENV
      // set to avoid defaulting to production mode which changes output paths.
      const result = runCLI(`build ${appName}`, {
        env: { NODE_ENV: 'test' },
      });

      checkFilesExist(`dist/${appName}/main.js`);
      checkFilesExist(`dist/${serverName}/index.js`);

      expect(result).toContain(
        `Successfully ran target build for project ${appName}`
      );
    });

    it('should support a function that returns an array of standard config objects', () => {
      const appName = uniq('app');
      const serverName = uniq('server');

      runCLI(
        `generate @nx/react:application --directory=apps/${appName} --bundler=rspack --e2eTestRunner=none`
      );

      // Create server index file
      createFile(
        `apps/${serverName}/index.js`,
        `console.log('Hello from ${serverName}');\n`
      );

      updateFile(
        `apps/${appName}/rspack.config.js`,
        `
          const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
          const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
          const { join } = require('path');
    
          module.exports = () => {
            return [
              {
            name: 'client',
            output: {
              path: join(__dirname, '../../dist/${appName}'),
            },
            devServer: {
              port: 4200,
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            plugins: [
              new NxAppRspackPlugin({
                tsConfig: './tsconfig.app.json',
                main: './src/main.tsx',
                index: './src/index.html',
                baseHref: '/',
                assets: ['./src/favicon.ico', './src/assets'],
                styles: ['./src/styles.scss'],
                outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
                optimization: process.env['NODE_ENV'] === 'production',
              }),
              new NxReactRspackPlugin({
                // Uncomment this line if you don't want to use SVGR
                // See: https://react-svgr.com/
                // svgr: false
              }),
            ],
          }, 
              {
                name: 'server',
                target: 'node',
                entry: '../${serverName}/index.js',
                output: {
                  path: join(__dirname, '../../dist/${serverName}'),
                  filename: 'index.js',
                }
              }
        ];
        };`
      );
      const result = runCLI(`build ${appName}`, {
        env: { NODE_ENV: 'test' },
      });

      checkFilesExist(`dist/${serverName}/index.js`);
      checkFilesExist(`dist/${appName}/main.js`);

      expect(result).toContain(
        `Successfully ran target build for project ${appName}`
      );
    });
  });
});
