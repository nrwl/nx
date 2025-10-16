import {
  checkFilesExist,
  fileExists,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest(['@nx/web', '@nx/webpack']);

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
