import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readProjectConfiguration } from '@nx/devkit';
// nx-ignore-next-line
import { applicationGenerator, hostGenerator } from '@nx/react';
import convertWebpack from './convert-webpack';

describe('Convert webpack', () => {
  it('should convert basic webpack project to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, {
      name: 'demo',
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
    expect(tree.read('demo/rspack.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "const { withReact } = require('@nx/rspack');
      const { withNx } = require('@nx/rspack');
      const { composePlugins } = require('@nx/rspack');

      // Nx plugins for webpack.
      module.exports = composePlugins(
        withNx(),
        withReact({
          // Uncomment this line if you don't want to use SVGR
          // See: https://react-svgr.com/
          // svgr: false
        }),
        (config) => {
          // Update the webpack config as needed here.
          // e.g. \`config.plugins.push(new MyPlugin())\`
          return config;
        }
      );
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
      name: 'demo',
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
    expect(tree.read('demo/rspack.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { withModuleFederation } from '@nx/rspack/module-federation';
      import { ModuleFederationConfig } from '@nx/rspack/module-federation';
      import { withReact } from '@nx/rspack';
      import { withNx } from '@nx/rspack';
      import { composePlugins } from '@nx/rspack';

      import baseConfig from './module-federation.config';

      const config: ModuleFederationConfig = {
        ...baseConfig,
      };

      // Nx plugins for webpack to build config object from Nx options and context.
      /**
       * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support for Module Federation
       * The DTS Plugin can be enabled by setting dts: true
       * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
       */
      export default composePlugins(
        withNx(),
        withReact(),
        withModuleFederation(config, { dts: false })
      );
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
      "import { withModuleFederation } from '@nx/rspack/module-federation';
      import { withReact } from '@nx/rspack';
      import { withNx } from '@nx/rspack';
      import { composePlugins } from '@nx/rspack';

      import baseConfig from './module-federation.config';

      const config = {
        ...baseConfig,
      };

      // Nx plugins for webpack to build config object from Nx options and context.
      /**
       * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support Module Federation
       * The DTS Plugin can be enabled by setting dts: true
       * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
       */
      export default composePlugins(
        withNx(),
        withReact(),
        withModuleFederation(config, { dts: false })
      );
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
      "import { withModuleFederation } from '@nx/rspack/module-federation';
      import { withReact } from '@nx/rspack';
      import { withNx } from '@nx/rspack';
      import { composePlugins } from '@nx/rspack';

      import baseConfig from './module-federation.config';

      const config = {
        ...baseConfig,
      };

      // Nx plugins for webpack to build config object from Nx options and context.
      /**
       * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support Module Federation
       * The DTS Plugin can be enabled by setting dts: true
       * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
       */
      export default composePlugins(
        withNx(),
        withReact(),
        withModuleFederation(config, { dts: false })
      );
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
