import {
  checkFilesExist,
  createFile,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest();

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
});
