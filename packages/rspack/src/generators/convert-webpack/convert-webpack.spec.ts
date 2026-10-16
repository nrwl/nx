import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
// nx-ignore-next-line
import { applicationGenerator } from '@nx/react';
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

    it('should refuse projects using a Module Federation executor', async () => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'host', {
        root: 'host',
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
            options: { webpackConfig: 'host/webpack.config.ts' },
          },
          serve: { executor: '@nx/react:module-federation-dev-server' },
        },
      });
      tree.write('host/webpack.config.ts', 'export default {};');

      await expect(convertWebpack(tree, { project: 'host' })).rejects.toThrow(
        'The project host is using Module Federation.'
      );
      expect(tree.exists('host/webpack.config.ts')).toBeTruthy();
    });

    it('should refuse projects with a module-federation.config file', async () => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'remote', {
        root: 'remote',
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
            options: { webpackConfig: 'remote/webpack.config.js' },
          },
        },
      });
      tree.write('remote/webpack.config.js', 'module.exports = {};');
      tree.write('remote/module-federation.config.js', 'module.exports = {};');

      await expect(convertWebpack(tree, { project: 'remote' })).rejects.toThrow(
        'The project remote is using Module Federation.'
      );
    });
  });
});
