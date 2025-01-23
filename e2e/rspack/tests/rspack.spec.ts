import { getPackageManagerCommand } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  listFiles,
  newProject,
  tmpProjPath,
  uniq,
  updateFile,
  runCLI,
  runCommand,
  createFile,
  readJson,
} from '@nx/e2e/utils';

import { writeFileSync } from 'fs';
import { join } from 'path';

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

  // This is disabled as the generator is no longer relevant
  xit('should create rspack root project and additional apps', async () => {
    const project = uniq('myapp');
    runCLI(
      `generate @nx/rspack:preset ${project} --framework=react --unitTestRunner=jest --e2eTestRunner=cypress --verbose`
    );

    // Added this so that the nx-ecosystem-ci tests don't throw jest error
    writeFileSync(
      join(tmpProjPath(), '.babelrc'),
      `
        {
          "presets": [
            "@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript",
            [
              "@nx/react/babel",
              {
                "runtime": "automatic"
              }
            ]
          ],
          "plugins": ["@babel/plugin-transform-runtime"]
        }
      `
    );

    const pm = getPackageManagerCommand();
    runCommand(
      pm.addDev +
        ' @babel/preset-react @babel/preset-env @babel/preset-typescript'
    );

    let result = runCLI(`build ${project}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result).toContain('Successfully ran target build');
    // Make sure expected files are present.
    /**
     * The files that are generated are:
     * ["assets", "favicon.ico", "index.html", "main.bf7851e6.js", "runtime.e4294127.js"]
     */
    expect(listFiles(`dist/${project}`)).toHaveLength(5);

    result = runCLI(`test ${project}`);
    expect(result).toContain('Successfully ran target test');

    // TODO(Colum): re-enable when cypress issue is resolved
    // result = runCLI(`e2e e2e`);
    // expect(result.stdout).toContain('Successfully ran target e2e');

    // Update app and make sure previous dist files are not present.
    updateFile(`src/app/app.tsx`, (content) => {
      return `${content}\nconsole.log('hello');
    `;
    });
    result = runCLI(`build ${project}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result).toContain('Successfully ran target build');
    expect(listFiles(`dist/${project}`)).toHaveLength(5); // same length as before

    // Generate a new app and check that the files are correct
    const app2 = uniq('app2');
    runCLI(
      `generate @nx/rspack:app ${app2} --framework=react --unitTestRunner=jest --e2eTestRunner=cypress --style=css`
    );
    checkFilesExist(`${app2}/project.json`, `${app2}-e2e/project.json`);

    // Added this so that the nx-ecosystem-ci tests don't throw jest error
    writeFileSync(
      join(tmpProjPath(), app2, '.babelrc'),
      `
        {
          "presets": [
            "@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript",
            [
              "@nx/react/babel",
              {
                "runtime": "automatic"
              }
            ]
          ],
          "plugins": ["@babel/plugin-transform-runtime"]
        }
      `
    );

    result = runCLI(`build ${app2}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app2}`)).toHaveLength(5);

    result = runCLI(`test ${app2}`);
    expect(result).toContain('Successfully ran target test');

    // TODO(Colum): re-enable when cypress issue is resolved
    // result = runCLI(`e2e ${app2}-e2e`);
    // expect(result.stdout).toContain('Successfully ran target e2e');

    // Generate a Nest app and verify build output
    const app3 = uniq('app3');
    runCLI(
      `generate @nx/rspack:app ${app3} --framework=nest --unitTestRunner=jest --no-interactive`
    );
    checkFilesExist(`${app3}/project.json`);

    result = runCLI(`build ${app3}`);
    expect(result).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app3}`)).toHaveLength(2);

    result = runCLI(`build ${app3} --generatePackageJson=true`);
    expect(result).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app3}`)).toHaveLength(4);
  }, 200_000);

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
