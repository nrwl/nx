import {
  checkFilesExist,
  createFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('config types', () => {
  setupWebpackTest();

  it('should support a function that returns an array of standard config objects', () => {
    const appName = uniq('app');
    const serverName = uniq('server');

    runCLI(
      `generate @nx/react:application --directory=apps/${appName} --bundler=webpack --e2eTestRunner=none`
    );

    // Create server index file
    createFile(
      `apps/${serverName}/index.js`,
      `console.log('Hello from ${serverName}');\n`
    );

    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
        const path  = require('path');
        const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
  
        module.exports = () => {
          return [
            {
              name: 'client',
              target: 'node',
              output: {
                path: path.join(__dirname, '../../dist/${appName}')
              },
              plugins: [
                new NxAppWebpackPlugin({
                  compiler: 'tsc',
                  main: './src/main.tsx',
                  tsConfig: './tsconfig.app.json',
                  outputHashing: 'none',
                  optimization: false,
                })
              ]
            }, 
            {
              name: 'server',
              target: 'node',
              entry: '../${serverName}/index.js',
              output: {
                path: path.join(__dirname, '../../dist/${serverName}'),
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
