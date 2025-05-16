import {
  checkFilesExist,
  cleanupProject,
  newProject,
  uniq,
  updateFile,
  runCLI,
  createFile,
  readJson,
} from '@nx/e2e/utils';

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

  describe('config types', () => {
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

      const result = runCLI(`build ${appName}`);

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
      const result = runCLI(`build ${appName}`);

      checkFilesExist(`dist/${serverName}/index.js`);
      checkFilesExist(`dist/${appName}/main.js`);

      expect(result).toContain(
        `Successfully ran target build for project ${appName}`
      );
    });
  });
});
