import 'nx/src/internal-testing-utils/mock-project-graph';

import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { getProjects, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { applicationGenerator } from './application';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
jest.mock('@nx/devkit', () => {
  return {
    ...jest.requireActual('@nx/devkit'),
    ensurePackage: jest.fn((pkg) => jest.requireActual(pkg)),
  };
});
describe('web app generator (legacy)', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  let originalEnv: string;

  beforeEach(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterEach(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
  });

  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree = createTreeWithEmptyWorkspace();
  });

  it('should setup webpack configuration', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      projectNameAndRootFormat: 'as-provided',
    });
    const project = readProjectConfiguration(tree, 'my-app');
    expect(project).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "my-app",
        "projectType": "application",
        "root": "my-app",
        "sourceRoot": "my-app/src",
        "tags": [],
        "targets": {
          "build": {
            "configurations": {
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
              "main": "my-app/src/main.ts",
              "outputPath": "dist/my-app",
              "scripts": [],
              "styles": [
                "my-app/src/styles.css",
              ],
              "target": "web",
              "tsConfig": "my-app/tsconfig.app.json",
              "webpackConfig": "my-app/webpack.config.js",
            },
            "outputs": [
              "{options.outputPath}",
            ],
          },
          "lint": {
            "executor": "@nx/eslint:lint",
          },
          "serve": {
            "configurations": {
              "production": {
                "buildTarget": "my-app:build:production",
              },
            },
            "executor": "@nx/webpack:dev-server",
            "options": {
              "buildTarget": "my-app:build",
            },
          },
          "test": {
            "executor": "@nx/jest:jest",
            "options": {
              "jestConfig": "my-app/jest.config.ts",
            },
            "outputs": [
              "{workspaceRoot}/coverage/{projectRoot}",
            ],
          },
        },
      }
    `);

    const webpackConfig = tree.read('my-app/webpack.config.js', 'utf-8');
    expect(webpackConfig).toMatchInlineSnapshot(`
      "const { composePlugins, withNx, withWeb } = require('@nx/webpack');

      // Nx plugins for webpack.
      module.exports = composePlugins(withNx(), withWeb(), (config) => {
        // Update the webpack config as needed here.
        // e.g. \`config.plugins.push(new MyPlugin())\`
        return config;
      });
      "
    `);
  });

  it('should add targets for vite', async () => {
    await applicationGenerator(tree, {
      name: 'my-vite-app',
      bundler: 'vite',
    });
    const projects = getProjects(tree);
    expect(projects.get('my-vite-app')).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "my-vite-app",
        "projectType": "application",
        "root": "my-vite-app",
        "sourceRoot": "my-vite-app/src",
        "tags": [],
        "targets": {
          "build": {
            "configurations": {
              "development": {
                "mode": "development",
              },
              "production": {
                "mode": "production",
              },
            },
            "defaultConfiguration": "production",
            "executor": "@nx/vite:build",
            "options": {
              "outputPath": "dist/my-vite-app",
            },
            "outputs": [
              "{options.outputPath}",
            ],
          },
          "lint": {
            "executor": "@nx/eslint:lint",
          },
          "preview": {
            "configurations": {
              "development": {
                "buildTarget": "my-vite-app:build:development",
              },
              "production": {
                "buildTarget": "my-vite-app:build:production",
              },
            },
            "defaultConfiguration": "development",
            "executor": "@nx/vite:preview-server",
            "options": {
              "buildTarget": "my-vite-app:build",
            },
          },
          "serve": {
            "configurations": {
              "development": {
                "buildTarget": "my-vite-app:build:development",
                "hmr": true,
              },
              "production": {
                "buildTarget": "my-vite-app:build:production",
                "hmr": false,
              },
            },
            "defaultConfiguration": "development",
            "executor": "@nx/vite:dev-server",
            "options": {
              "buildTarget": "my-vite-app:build",
            },
          },
          "test": {
            "executor": "@nx/jest:jest",
            "options": {
              "jestConfig": "my-vite-app/jest.config.ts",
            },
            "outputs": [
              "{workspaceRoot}/coverage/{projectRoot}",
            ],
          },
        },
      }
    `);
  });
});
