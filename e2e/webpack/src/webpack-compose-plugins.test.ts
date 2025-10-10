import { runCLI, uniq, updateFile } from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest();

  it('should be able to support webpack config with nx enhanced and babel', () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/web:app ${appName} --directory=apps/${appName} --bundler=webpack --compiler=babel`
    );

    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
      const { composePlugins, withNx } = require('@nx/webpack');
      const { withReact } = require('@nx/react');
      const { join } = require('path');
      
      const pluginOption = {
        index: 'apps/${appName}/src/index.html',
        main: 'apps/${appName}/src/main.ts',
        tsConfig: 'apps/${appName}/tsconfig.app.json',
        outputPath: 'dist/apps/${appName}',
      }
      
      // Nx composable plugins for webpack.
      module.exports = composePlugins(
        withNx(pluginOption),
        withReact(pluginOption),
      );`
    );

    const result = runCLI(`build ${appName}`);

    expect(result).toContain(`nx run ${appName}:build`);
    expect(result).toContain(
      `Successfully ran target build for project ${appName}`
    );
  });
});
