import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
// nx-ignore-next-line
import { applicationGenerator, hostGenerator } from '@nx/react';
// nx-ignore-next-line
import { applicationGenerator as nestApplicationGenerator } from '@nx/nest';
import convertWebpack from './convert-webpack';

describe('Convert webpack', () => {
  describe('convert webpack config that uses plugin', () => {
    it('should convert basic nest webpack config to rspack', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await nestApplicationGenerator(tree, {
        directory: 'demo',
        e2eTestRunner: 'none',
        linter: 'none',
        addPlugin: true,
      });

      // ACT
      await convertWebpack(tree, { project: 'demo' });

      // ASSERT
      expect(tree.read('demo/rspack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { join } = require('path');

        module.exports = {
          output: {
            path: join(__dirname, '../dist/demo'),
            clean: true,
            ...(process.env.NODE_ENV !== 'production' && {
              devtoolModuleFilenameTemplate: '[absolute-resource-path]',
            }),
          },
          plugins: [
            new NxAppRspackPlugin({
              target: 'node',
              compiler: 'tsc',
              main: './src/main.ts',
              tsConfig: './tsconfig.app.json',
              assets: ['./src/assets'],
              optimization: false,
              outputHashing: 'none',
              generatePackageJson: true,
              sourceMap: true,
            }),
          ],
        };
        "
      `);
    });
  });
  describe('convert webpack config that uses with* helpers', () => {
    it.each(['options', 'configuration'])(
      'converts function flags independently of the config path in %s',
      async (configLocation) => {
        const tree = createTreeWithEmptyWorkspace();
        await applicationGenerator(tree, {
          directory: 'demo',
          bundler: 'webpack',
          e2eTestRunner: 'none',
          unitTestRunner: 'none',
          style: 'css',
          linter: 'none',
          addPlugin: false,
        });
        const project = readProjectConfiguration(tree, 'demo');
        project.targets.build.options.standardWebpackConfigFunction = true;
        project.targets.build.configurations.development.standardWebpackConfigFunction = false;
        if (configLocation === 'configuration') {
          project.targets.build.configurations.production.webpackConfig =
            project.targets.build.options.webpackConfig;
          delete project.targets.build.options.webpackConfig;
        }
        updateProjectConfiguration(tree, 'demo', project);

        await convertWebpack(tree, { project: 'demo' });

        const build = readProjectConfiguration(tree, 'demo').targets.build;
        expect(build.options.standardRspackConfigFunction).toBe(true);
        expect(build.options).not.toHaveProperty(
          'standardWebpackConfigFunction'
        );
        expect(
          build.configurations.development.standardRspackConfigFunction
        ).toBe(false);
        expect(build.configurations.development).not.toHaveProperty(
          'standardWebpackConfigFunction'
        );
        const configOptions =
          configLocation === 'options'
            ? build.options
            : build.configurations.production;
        expect(configOptions.rspackConfig).toBe('demo/rspack.config.js');
        expect(tree.exists(configOptions.rspackConfig)).toBe(true);
      }
    );

    it('should convert basic webpack project to rspack', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await applicationGenerator(tree, {
        directory: 'demo',
        bundler: 'webpack',
        e2eTestRunner: 'playwright',
        linter: 'none',
        style: 'css',
        addPlugin: false,
      });

      // ACT
      await convertWebpack(tree, { project: 'demo' });

      // ASSERT
      const project = readProjectConfiguration(tree, 'demo');

      expect(tree.exists('demo/rspack.config.js')).toBeTruthy();
      expect(tree.read('demo/rspack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
          "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
          const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

          module.exports = {
            output: { clean: true },
            plugins: [new NxAppRspackPlugin(), new NxReactRspackPlugin()],
          };
          "
        `);
      expect(project.targets.build).toMatchInlineSnapshot(`
        {
          "configurations": {
            "development": {
              "extractLicenses": false,
              "optimization": false,
              "sourceMap": true,
              "vendorChunk": true,
            },
            "production": {
              "extractLicenses": true,
              "fileReplacements": [
                {
                  "replace": "demo/src/environments/environment.ts",
                  "with": "demo/src/environments/environment.prod.ts",
                },
              ],
              "namedChunks": false,
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "vendorChunk": false,
            },
          },
          "defaultConfiguration": "production",
          "executor": "@nx/rspack:rspack",
          "options": {
            "assets": [
              "demo/src/favicon.ico",
              "demo/src/assets",
            ],
            "baseHref": "/",
            "compiler": "babel",
            "index": "demo/src/index.html",
            "main": "demo/src/main.tsx",
            "outputPath": "dist/demo",
            "rspackConfig": "demo/rspack.config.js",
            "scripts": [],
            "standardRspackConfigFunction": true,
            "styles": [
              "demo/src/styles.css",
            ],
            "target": "web",
            "tsConfig": "demo/tsconfig.app.json",
          },
          "outputs": [
            "{options.outputPath}",
          ],
        }
      `);
      expect(project.targets.serve).toMatchInlineSnapshot(`
              {
                "configurations": {
                  "development": {
                    "buildTarget": "demo:build:development",
                  },
                  "production": {
                    "buildTarget": "demo:build:production",
                    "hmr": false,
                  },
                },
                "defaultConfiguration": "development",
                "executor": "@nx/rspack:dev-server",
                "options": {
                  "buildTarget": "demo:build",
                  "hmr": true,
                },
              }
          `);
    });

    it('should convert react module federation webpack projects to rspack', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await hostGenerator(tree, {
        directory: 'demo',
        bundler: 'webpack',
        e2eTestRunner: 'playwright',
        remotes: ['remote1', 'remote2'],
        linter: 'none',
        style: 'css',
        addPlugin: false,
        unitTestRunner: 'none',
        typescriptConfiguration: true,
      });

      // ACT
      await convertWebpack(tree, { project: 'demo' });
      await convertWebpack(tree, { project: 'remote1' });
      await convertWebpack(tree, { project: 'remote2' });

      // ASSERT
      const project = readProjectConfiguration(tree, 'demo');

      expect(tree.exists('demo/rspack.config.ts')).toBeTruthy();
      expect(tree.read('demo/rspack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
          "import { withModuleFederation } from '@nx/module-federation/rspack';
          import { NxAppRspackPlugin } from '@nx/rspack/app-plugin';
          import type { Compiler } from '@rspack/core';
          import { NxReactRspackPlugin } from '@nx/rspack/react-plugin';

          import type { ModuleFederationConfig } from '@nx/module-federation';

          import baseConfig from './module-federation.config';

          const config: ModuleFederationConfig = {
            ...baseConfig,
          };

          /**
           * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support for Module Federation
           * The DTS Plugin can be enabled by setting dts: true
           * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
           */
          export default async () => {
            const configureFederation = await withModuleFederation(config, { dts: false });
            const webpackConfig = configureFederation(
              {
                mode:
                  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production'
                    ? process.env.NODE_ENV
                    : 'none',
                output: {},
                plugins: [],
              },
              undefined,
            );
            const runtimeChunk = webpackConfig.optimization?.runtimeChunk;
            webpackConfig.plugins.unshift(new NxAppRspackPlugin(), new NxReactRspackPlugin(), {
              apply(compiler: Compiler) {
                if (runtimeChunk !== undefined) {
                  compiler.options.optimization.runtimeChunk = runtimeChunk;
                }
              },
            });
            return webpackConfig;
          };
          "
        `);
      expect(project.targets.build).toMatchInlineSnapshot(`
        {
          "configurations": {
            "development": {
              "extractLicenses": false,
              "optimization": false,
              "sourceMap": true,
              "vendorChunk": true,
            },
            "production": {
              "extractLicenses": true,
              "fileReplacements": [
                {
                  "replace": "demo/src/environments/environment.ts",
                  "with": "demo/src/environments/environment.prod.ts",
                },
              ],
              "namedChunks": false,
              "optimization": true,
              "outputHashing": "all",
              "rspackConfig": "demo/rspack.config.prod.ts",
              "sourceMap": false,
              "standardRspackConfigFunction": true,
              "vendorChunk": false,
            },
          },
          "defaultConfiguration": "production",
          "executor": "@nx/rspack:rspack",
          "options": {
            "assets": [
              "demo/src/favicon.ico",
              "demo/src/assets",
            ],
            "baseHref": "/",
            "compiler": "babel",
            "index": "demo/src/index.html",
            "main": "demo/src/main.ts",
            "outputPath": "dist/demo",
            "rspackConfig": "demo/rspack.config.ts",
            "scripts": [],
            "standardRspackConfigFunction": true,
            "styles": [
              "demo/src/styles.css",
            ],
            "target": "web",
            "tsConfig": "demo/tsconfig.app.json",
          },
          "outputs": [
            "{options.outputPath}",
          ],
        }
      `);
      expect(project.targets.serve).toMatchInlineSnapshot(`
              {
                "configurations": {
                  "development": {
                    "buildTarget": "demo:build:development",
                  },
                  "production": {
                    "buildTarget": "demo:build:production",
                    "hmr": false,
                  },
                },
                "defaultConfiguration": "development",
                "executor": "@nx/rspack:module-federation-dev-server",
                "options": {
                  "buildTarget": "demo:build",
                  "hmr": true,
                  "port": 4200,
                },
              }
          `);

      const remote1 = readProjectConfiguration(tree, 'remote1');

      expect(tree.exists('remote1/rspack.config.ts')).toBeTruthy();
      expect(tree.read('remote1/rspack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
          "import { withModuleFederation } from '@nx/module-federation/rspack';
          import { NxAppRspackPlugin } from '@nx/rspack/app-plugin';
          import type { Compiler } from '@rspack/core';
          import { NxReactRspackPlugin } from '@nx/rspack/react-plugin';

          import baseConfig from './module-federation.config';

          const config = {
            ...baseConfig,
          };

          /**
           * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support Module Federation
           * The DTS Plugin can be enabled by setting dts: true
           * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
           */
          export default async () => {
            const configureFederation = await withModuleFederation(config, { dts: false });
            const webpackConfig = configureFederation(
              {
                mode:
                  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production'
                    ? process.env.NODE_ENV
                    : 'none',
                output: {},
                plugins: [],
              },
              undefined,
            );
            const runtimeChunk = webpackConfig.optimization?.runtimeChunk;
            webpackConfig.plugins.unshift(new NxAppRspackPlugin(), new NxReactRspackPlugin(), {
              apply(compiler: Compiler) {
                if (runtimeChunk !== undefined) {
                  compiler.options.optimization.runtimeChunk = runtimeChunk;
                }
              },
            });
            return webpackConfig;
          };
          "
        `);
      expect(tree.exists('remote1/rspack.config.prod.ts')).toBeTruthy();
      expect(tree.read('remote1/rspack.config.prod.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
              "export default require('./rspack.config');
              "
          `);
      expect(project.targets.build).toMatchInlineSnapshot(`
        {
          "configurations": {
            "development": {
              "extractLicenses": false,
              "optimization": false,
              "sourceMap": true,
              "vendorChunk": true,
            },
            "production": {
              "extractLicenses": true,
              "fileReplacements": [
                {
                  "replace": "demo/src/environments/environment.ts",
                  "with": "demo/src/environments/environment.prod.ts",
                },
              ],
              "namedChunks": false,
              "optimization": true,
              "outputHashing": "all",
              "rspackConfig": "demo/rspack.config.prod.ts",
              "sourceMap": false,
              "standardRspackConfigFunction": true,
              "vendorChunk": false,
            },
          },
          "defaultConfiguration": "production",
          "executor": "@nx/rspack:rspack",
          "options": {
            "assets": [
              "demo/src/favicon.ico",
              "demo/src/assets",
            ],
            "baseHref": "/",
            "compiler": "babel",
            "index": "demo/src/index.html",
            "main": "demo/src/main.ts",
            "outputPath": "dist/demo",
            "rspackConfig": "demo/rspack.config.ts",
            "scripts": [],
            "standardRspackConfigFunction": true,
            "styles": [
              "demo/src/styles.css",
            ],
            "target": "web",
            "tsConfig": "demo/tsconfig.app.json",
          },
          "outputs": [
            "{options.outputPath}",
          ],
        }
      `);
      expect(project.targets.serve).toMatchInlineSnapshot(`
              {
                "configurations": {
                  "development": {
                    "buildTarget": "demo:build:development",
                  },
                  "production": {
                    "buildTarget": "demo:build:production",
                    "hmr": false,
                  },
                },
                "defaultConfiguration": "development",
                "executor": "@nx/rspack:module-federation-dev-server",
                "options": {
                  "buildTarget": "demo:build",
                  "hmr": true,
                  "port": 4200,
                },
              }
          `);

      const remote2 = readProjectConfiguration(tree, 'remote2');

      expect(tree.exists('remote2/rspack.config.ts')).toBeTruthy();
      expect(tree.read('remote2/rspack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
          "import { withModuleFederation } from '@nx/module-federation/rspack';
          import { NxAppRspackPlugin } from '@nx/rspack/app-plugin';
          import type { Compiler } from '@rspack/core';
          import { NxReactRspackPlugin } from '@nx/rspack/react-plugin';

          import baseConfig from './module-federation.config';

          const config = {
            ...baseConfig,
          };

          /**
           * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support Module Federation
           * The DTS Plugin can be enabled by setting dts: true
           * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
           */
          export default async () => {
            const configureFederation = await withModuleFederation(config, { dts: false });
            const webpackConfig = configureFederation(
              {
                mode:
                  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production'
                    ? process.env.NODE_ENV
                    : 'none',
                output: {},
                plugins: [],
              },
              undefined,
            );
            const runtimeChunk = webpackConfig.optimization?.runtimeChunk;
            webpackConfig.plugins.unshift(new NxAppRspackPlugin(), new NxReactRspackPlugin(), {
              apply(compiler: Compiler) {
                if (runtimeChunk !== undefined) {
                  compiler.options.optimization.runtimeChunk = runtimeChunk;
                }
              },
            });
            return webpackConfig;
          };
          "
        `);
      expect(tree.exists('remote2/rspack.config.prod.ts')).toBeTruthy();
      expect(tree.read('remote2/rspack.config.prod.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
              "export default require('./rspack.config');
              "
          `);
      expect(project.targets.build).toMatchInlineSnapshot(`
        {
          "configurations": {
            "development": {
              "extractLicenses": false,
              "optimization": false,
              "sourceMap": true,
              "vendorChunk": true,
            },
            "production": {
              "extractLicenses": true,
              "fileReplacements": [
                {
                  "replace": "demo/src/environments/environment.ts",
                  "with": "demo/src/environments/environment.prod.ts",
                },
              ],
              "namedChunks": false,
              "optimization": true,
              "outputHashing": "all",
              "rspackConfig": "demo/rspack.config.prod.ts",
              "sourceMap": false,
              "standardRspackConfigFunction": true,
              "vendorChunk": false,
            },
          },
          "defaultConfiguration": "production",
          "executor": "@nx/rspack:rspack",
          "options": {
            "assets": [
              "demo/src/favicon.ico",
              "demo/src/assets",
            ],
            "baseHref": "/",
            "compiler": "babel",
            "index": "demo/src/index.html",
            "main": "demo/src/main.ts",
            "outputPath": "dist/demo",
            "rspackConfig": "demo/rspack.config.ts",
            "scripts": [],
            "standardRspackConfigFunction": true,
            "styles": [
              "demo/src/styles.css",
            ],
            "target": "web",
            "tsConfig": "demo/tsconfig.app.json",
          },
          "outputs": [
            "{options.outputPath}",
          ],
        }
      `);
      expect(project.targets.serve).toMatchInlineSnapshot(`
              {
                "configurations": {
                  "development": {
                    "buildTarget": "demo:build:development",
                  },
                  "production": {
                    "buildTarget": "demo:build:production",
                    "hmr": false,
                  },
                },
                "defaultConfiguration": "development",
                "executor": "@nx/rspack:module-federation-dev-server",
                "options": {
                  "buildTarget": "demo:build",
                  "hmr": true,
                  "port": 4200,
                },
              }
          `);
    });
  });
});
