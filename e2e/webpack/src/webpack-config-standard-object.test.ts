import { runCLI, uniq, updateFile } from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('config types', () => {
  setupWebpackTest();

  it('should support a standard config object', () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/react:application --directory=apps/${appName} --bundler=webpack --e2eTestRunner=none`
    );

    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
        const path  = require('path');
        const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
  
        module.exports = {
          target: 'node',
          output: {
            path: path.join(__dirname, '../../dist/${appName}')
          },
          plugins: [
            new NxAppWebpackPlugin({
              compiler: 'babel',
              main: './src/main.tsx',
              tsConfig: './tsconfig.app.json',
              outputHashing: 'none',
              optimization: false,
            })
          ]
        };`
    );

    const result = runCLI(`build ${appName}`);

    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  });
});
