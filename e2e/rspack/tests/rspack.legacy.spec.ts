import {
  cleanupProject,
  newProject,
  uniq,
  updateFile,
  runCLI,
  updateJson,
} from '@nx/e2e-utils';

describe('rspack e2e legacy', () => {
  let originalEnv;

  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
    newProject({ packages: ['@nx/rspack', '@nx/react'] });
    originalEnv = process.env.NODE_ENV;
  });
  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    cleanupProject();
  });

  it('should support a standard config object', () => {
    const appName = uniq('non-inferred-app');

    runCLI(
      `generate @nx/react:app --directory=apps/${appName} --bundler=rspack --e2eTestRunner=none`,
      { env: { NX_ADD_PLUGINS: 'false' } }
    );

    updateJson(`apps/${appName}/project.json`, (json) => {
      json.targets.build.options.standardRspackConfigFunction = true;
      return json;
    });

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

  it('should support Nx config function that returns a config object', () => {
    const appName = uniq('non-inferred-app');

    runCLI(
      `generate @nx/react:application --directory=apps/${appName} --bundler=rspack --e2eTestRunner=none --style=css --no-interactive`,
      { env: { NX_ADD_PLUGINS: 'false' } }
    );

    updateFile(
      `apps/${appName}/rspack.config.js`,
      `
    const { composePlugins, withNx, withReact } = require('@nx/rspack');
    
    // Nx plugins for rspack.
    module.exports = composePlugins(
      withNx(),
      withReact({
        // Uncomment this line if you don't want to use SVGR
        // See: https://react-svgr.com/
        // svgr: false
      }),
      (config) => {
        // Update the rspack config as needed here.
        return config;
      }
    );`
    );

    const result = runCLI(`build ${appName}`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  });
});
