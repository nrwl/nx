/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * webpack package. It tests the core public API.
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
  createFile,
  fileExists,
  listFiles,
  newProject,
  readFile,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

describe('Webpack essential tests', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/web', '@nx/webpack', '@nx/eslint'],
    });
  });

  afterAll(() => cleanupProject());

  it('should be able to build with NxWebpackPlugin and a standard webpack config file', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler webpack --directory=apps/${appName}`
    );
    updateFile(`apps/${appName}/src/main.ts`, `console.log('Hello');\n`);
    updateFile(`apps/${appName}/src/foo.ts`, `console.log('Foo');\n`);
    updateFile(`apps/${appName}/src/bar.ts`, `console.log('Bar');\n`);

    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
      const path  = require('path');
      const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');

      module.exports = {
        target: 'node',
        output: {
          path: path.join(__dirname, '../../dist/apps/${appName}'),
          // do not remove dist, so files between builds will remain
          clean: false,
        },
        plugins: [
          new NxAppWebpackPlugin({
            compiler: 'tsc',
            main: './src/main.ts',
            additionalEntryPoints: [
              './src/foo.ts',
              {
                entryName: 'bar',
                entryPath: './src/bar.ts', 
              }
            ],
            tsConfig: './tsconfig.app.json',
            outputHashing: 'none',
            optimization: false,
          })
        ]
      };`
    );

    runCLI(`build ${appName}`);

    expect(runCommand(`node dist/apps/${appName}/main.js`)).toMatch(/Hello/);
    expect(runCommand(`node dist/apps/${appName}/foo.js`)).toMatch(/Foo/);
    expect(runCommand(`node dist/apps/${appName}/bar.js`)).toMatch(/Bar/);

    // Ensure dist is not removed between builds since output.clean === false
    createFile(`dist/apps/${appName}/extra.js`);
    runCLI(`build ${appName} --skip-nx-cache`);
    checkFilesExist(`dist/apps/${appName}/extra.js`);
  }, 500_000);

  it('should bundle in NX_PUBLIC_ environment variables', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --directory=apps/${appName} --bundler webpack`
    );

    checkFilesExist(`apps/${appName}/src/main.ts`);
    updateFile(
      `apps/${appName}/src/main.ts`,
      `
      console.log(process.env['NX_PUBLIC_TEST']);
      `
    );

    runCLI(`build ${appName}`, {
      env: {
        NX_PUBLIC_TEST: 'foobar',
      },
    });

    const mainFile = listFiles(`dist/apps/${appName}`).filter((f) =>
      f.startsWith('main.')
    );
    const content = readFile(`dist/apps/${appName}/${mainFile}`);
    expect(content).toMatch(/foobar/);
  });

  it('should allow options to be passed from the executor', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --directory=apps/${appName} --bundler webpack`
    );

    checkFilesExist(`apps/${appName}/project.json`);
    updateJson(`apps/${appName}/project.json`, (json) => {
      json.targets.build = {
        executor: '@nx/webpack:webpack',
        outputs: ['{options.outputPath}'],
        options: {
          generatePackageJson: true, // This should be passed to the plugin.
          outputPath: `dist/apps/${appName}`,
          webpackConfig: `apps/${appName}/webpack.config.js`,
        },
      };
      return json;
    });

    checkFilesExist(`apps/${appName}/webpack.config.js`);
    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
        const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { join } = require('path');
        module.exports = {
          output: {
            path: join(__dirname, '../../dist/apps/demo'),
          },
          plugins: [
            new NxAppWebpackPlugin({
              // NOTE: generatePackageJson is missing here, but executor passes it.
              target: 'web',
              compiler: 'swc',
              main: './src/main.ts',
              tsConfig: './tsconfig.app.json',
              optimization: false,
              outputHashing: 'none',
            }),
          ],
        };`
    );

    runCLI(`build ${appName}`);

    fileExists(`dist/apps/${appName}/package.json`);
  });
});
