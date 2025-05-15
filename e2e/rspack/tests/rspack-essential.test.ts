/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * rspack package. It tests the core public API.
 *
 * FAILURE POLICY
 *  - If any test here fails, the package is considered broken.
 *  - Fix the underlying issue immediately, do not merge or release until green.
 *  - Do not update snapshots here without an accompanying, intentional code change.
 *
 * GUIDELINES
 *  - Keep tests small and focused on fundamental behavior.
 *  - No edge-cases we should only test the critical paths.
 *  - CI pipelines must block on failures in this file (no skips or timeouts).
 *
 * MAINTENANCE
 *  - Whenever you change core behavior, update this file first to cover the new expectations.
 *  - Add new “essential” tests here only if they test core functionality.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import {
  checkFilesExist,
  cleanupProject,
  newProject,
  uniq,
  updateFile,
  runCLI,
  createFile,
} from '@nx/e2e/utils';

describe('Rspack essential tests', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/react', '@nx/rspack'] });
  });

  afterAll(() => cleanupProject());

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
});
