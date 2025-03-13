import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToRspack } from './convert-to-rspack';
import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  writeJson,
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
    writeJson(tree, 'apps/app/tsconfig.json', {});

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    const pkgJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { resolve } from 'path';
      import { createConfig } from '@nx/angular-rspack';

      export default createConfig({
        options: {
          root: __dirname,

          outputPath: {
            base: '../../dist/apps/app',
          },
          index: './src/index.html',
          browser: './src/main.ts',
          polyfills: ['zone.js'],
          tsConfig: './tsconfig.app.json',
          assets: [
            './src/favicon.ico',
            './src/assets',
            {
              input: './public',
              glob: '**/*',
            },
          ],
          styles: ['./src/styles.scss'],
          scripts: [],
        },
      });
      "
    `);
    expect(pkgJson.devDependencies['@nx/angular-rspack']).toBeDefined();
    expect(
      nxJson.plugins.find((p) =>
        typeof p === 'string' ? false : p.plugin === '@nx/rspack/plugin'
      )
    ).toBeDefined();
    expect(updatedProject.targets.build).not.toBeDefined();
    expect(updatedProject.targets.serve).not.toBeDefined();
  });

  it('should convert a basic angular webpack application with configurations to rspack', async () => {
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
          configurations: {
            production: {
              outputPath: 'dist/apps/app-prod',
              index: 'apps/app/src/index.prod.html',
              main: 'apps/app/src/main.prod.ts',
              tsConfig: 'apps/app/tsconfig.prod.json',
            },
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {});

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    const pkgJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { resolve } from 'path';
      import { createConfig } from '@nx/angular-rspack';

      export default createConfig(
        {
          options: {
            root: __dirname,

            outputPath: {
              base: '../../dist/apps/app',
            },
            index: './src/index.html',
            browser: './src/main.ts',
            polyfills: ['zone.js'],
            tsConfig: './tsconfig.app.json',
            assets: [
              './src/favicon.ico',
              './src/assets',
              {
                input: './public',
                glob: '**/*',
              },
            ],
            styles: ['./src/styles.scss'],
            scripts: [],
          },
        },
        {
          production: {
            options: {
              outputPath: {
                base: '../../dist/apps/app-prod',
              },
              index: './src/index.prod.html',
              browser: './src/main.prod.ts',
              tsConfig: './tsconfig.prod.json',
            },
          },
        }
      );
      "
    `);
    expect(pkgJson.devDependencies['@nx/angular-rspack']).toBeDefined();
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
    writeJson(tree, 'apps/app/tsconfig.json', {});
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
      "import { resolve } from 'path';
      import { createConfig } from '@nx/angular-rspack';
      import baseWebpackConfig from './webpack.config';
      import webpackMerge from 'webpack-merge';

      const baseConfig = createConfig({
        options: {
          root: __dirname,

          outputPath: {
            base: '../../dist/apps/app',
          },
          index: './src/index.html',
          browser: './src/main.ts',
          polyfills: ['zone.js'],
          tsConfig: './tsconfig.app.json',
          assets: [
            './src/favicon.ico',
            './src/assets',
            {
              input: './public',
              glob: '**/*',
            },
          ],
          styles: ['./src/styles.scss'],
          scripts: [],
        },
      });

      export default webpackMerge(baseConfig[0], baseWebpackConfig);
      "
    `);
    expect(tree.read('apps/app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { NxModuleFederationPlugin } = require('@nx/module-federation/rspack');
      const config = require('./module-federation.config');

      module.exports = {
        plugins: [
          new NxModuleFederationPlugin(
            { config },
            {
              dts: false,
            }
          ),
        ],
      };
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
    writeJson(tree, 'apps/app/tsconfig.json', {});
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
      "import { resolve } from 'path';
      import { createConfig } from '@nx/angular-rspack';
      import baseWebpackConfig from './webpack.config';
      import webpackMerge from 'webpack-merge';

      const baseConfig = createConfig({
        options: {
          root: __dirname,

          outputPath: {
            base: '../../dist/apps/app',
          },
          index: './src/index.html',
          browser: './src/main.ts',
          polyfills: ['zone.js'],
          tsConfig: './tsconfig.app.json',
          assets: [
            './src/favicon.ico',
            './src/assets',
            {
              input: './public',
              glob: '**/*',
            },
          ],
          styles: ['./src/styles.scss'],
          scripts: [],
        },
      });

      export default webpackMerge(baseConfig[0], baseWebpackConfig);
      "
    `);
  });
});
