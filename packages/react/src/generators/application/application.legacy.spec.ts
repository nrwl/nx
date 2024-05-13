import 'nx/src/internal-testing-utils/mock-project-graph';

import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { getProjects, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { applicationGenerator } from './application';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
describe('react app generator (legacy)', () => {
  let appTree: Tree;
  let schema: Schema = {
    compiler: 'babel',
    e2eTestRunner: 'cypress',
    skipFormat: false,
    name: 'my-app',
    linter: Linter.EsLint,
    style: 'css',
    strict: true,
    projectNameAndRootFormat: 'as-provided',
    addPlugin: false,
  };
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should setup webpack config that is compatible without project targets', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'webpack',
    });

    const targets = readProjectConfiguration(appTree, 'my-app').targets;
    expect(targets.build).toMatchInlineSnapshot(`
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
                "replace": "my-app/src/environments/environment.ts",
                "with": "my-app/src/environments/environment.prod.ts",
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
        "executor": "@nx/webpack:webpack",
        "options": {
          "assets": [
            "my-app/src/favicon.ico",
            "my-app/src/assets",
          ],
          "baseHref": "/",
          "compiler": "babel",
          "index": "my-app/src/index.html",
          "main": "my-app/src/main.tsx",
          "outputPath": "dist/my-app",
          "scripts": [],
          "styles": [
            "my-app/src/styles.css",
          ],
          "tsConfig": "my-app/tsconfig.app.json",
          "webpackConfig": "my-app/webpack.config.js",
        },
        "outputs": [
          "{options.outputPath}",
        ],
      }
    `);
    expect(targets.serve).toMatchInlineSnapshot(`
      {
        "configurations": {
          "development": {
            "buildTarget": "my-app:build:development",
          },
          "production": {
            "buildTarget": "my-app:build:production",
            "hmr": false,
          },
        },
        "defaultConfiguration": "development",
        "executor": "@nx/webpack:dev-server",
        "options": {
          "buildTarget": "my-app:build",
          "hmr": true,
        },
      }
    `);

    const webpackConfig = appTree.read('my-app/webpack.config.js', 'utf-8');
    expect(webpackConfig).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/webpack');
      const { withReact } = require('@nx/react');

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
  });

  it('should setup vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-vite-app',
      bundler: 'vite',
      skipFormat: true,
    });
    expect(
      appTree.read('my-vite-app/vite.config.ts', 'utf-8')
    ).toMatchSnapshot();
  });
});
