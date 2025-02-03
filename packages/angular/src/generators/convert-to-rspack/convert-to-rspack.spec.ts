import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToRspack } from './convert-to-rspack';
import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
} from '@nx/devkit';
import * as _configUtils from '@nx/devkit/src/utils/config-utils';

jest.mock('@nx/devkit/src/utils/config-utils', () => ({
  ...jest.requireActual('@nx/devkit/src/utils/config-utils'),
  loadConfigFile: jest.fn().mockImplementation(async (path) => {
    return () => {
      return {};
    };
  }),
}));

describe('convert-to-rspack', () => {
  it('should convert a basic angular webpack application to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['zone.js'],
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
        },
      },
    });

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    const pkgJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { createConfig } = require('@ng-rspack/build');

      module.exports = createConfig({
        root: __dirname,
        index: './src/index.html',
        browser: './src/main.ts',

        tsconfigPath: './tsconfig.app.json',
        polyfills: ['zone.js'],
        assets: ['./src/favicon.ico', './src/assets', './public'],
        styles: ['./src/styles.scss'],
        scripts: [],
        jit: false,
        inlineStylesExtension: 'css',
        fileReplacements: [],
        hasServer: false,
        skipTypeChecking: false,
      });
      "
    `);
    expect(pkgJson.devDependencies['@ng-rspack/build']).toBeDefined();
    expect(
      nxJson.plugins.find((p) =>
        typeof p === 'string' ? false : p.plugin === '@nx/rspack/plugin'
      )
    ).toBeDefined();
    expect(updatedProject.targets.build).not.toBeDefined();
    expect(updatedProject.targets.serve).not.toBeDefined();
  });

  it('should convert an angular webpack application with custom webpack config function to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:webpack-browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['zone.js'],
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
            customWebpackConfig: {
              path: 'apps/app/webpack.config.js',
            },
          },
        },
      },
    });
    tree.write(
      'apps/app/module-federation.config.js',
      `
    module.exports = {
      name: 'app',
      exposes: {
        './app': './src/app/index.ts',
      },
      remotes: ['remote1', 'remote2'],
    };
    `
    );
    tree.write(
      'apps/app/webpack.config.js',
      `
    const { withModuleFederation } = require('@nx/module-federation/angular');
    const config = require('./module-federation.config');
    module.exports = withModuleFederation(config, { dts: false });
    `
    );

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { createConfig } = require('@ng-rspack/build');
      const baseWebpackConfig = require('./webpack.config');

      const baseConfig = createConfig({
        root: __dirname,
        index: './src/index.html',
        browser: './src/main.ts',

        tsconfigPath: './tsconfig.app.json',
        polyfills: ['zone.js'],
        assets: ['./src/favicon.ico', './src/assets', './public'],
        styles: ['./src/styles.scss'],
        scripts: [],
        jit: false,
        inlineStylesExtension: 'css',
        fileReplacements: [],
        hasServer: false,
        skipTypeChecking: false,
      });

      module.exports = baseWebpackConfig(baseConfig);
      "
    `);
  });

  it('should convert an angular webpack application with custom webpack config to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:webpack-browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['zone.js'],
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
            customWebpackConfig: {
              path: 'apps/app/webpack.config.js',
            },
          },
        },
      },
    });
    tree.write(
      'apps/app/module-federation.config.js',
      `
    module.exports = {
      name: 'app',
      exposes: {
        './app': './src/app/index.ts',
      },
      remotes: ['remote1', 'remote2'],
    };
    `
    );
    tree.write('apps/app/webpack.config.js', ``);

    jest
      .spyOn(_configUtils, 'loadConfigFile')
      .mockImplementation(async (path) => {
        return {
          default: {
            module: {
              rules: [
                {
                  test: /\.css$/,
                  use: ['style-loader', 'css-loader'],
                },
              ],
            },
          },
        };
      });

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { createConfig } = require('@ng-rspack/build');
      const baseWebpackConfig = require('./webpack.config');
      const webpackMerge = require('webpack-merge');

      const baseConfig = createConfig({
        root: __dirname,
        index: './src/index.html',
        browser: './src/main.ts',

        tsconfigPath: './tsconfig.app.json',
        polyfills: ['zone.js'],
        assets: ['./src/favicon.ico', './src/assets', './public'],
        styles: ['./src/styles.scss'],
        scripts: [],
        jit: false,
        inlineStylesExtension: 'css',
        fileReplacements: [],
        hasServer: false,
        skipTypeChecking: false,
      });

      module.exports = webpackMerge(baseConfig, baseWebpackConfig);
      "
    `);
  });
});
