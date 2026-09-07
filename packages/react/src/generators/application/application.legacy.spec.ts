import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { getInstalledCypressMajorVersion } from '@nx/cypress/internal';
import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from './application';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/internal', () => ({
  ...jest.requireActual('@nx/cypress/internal'),
  getInstalledCypressMajorVersion: jest.fn(),
}));
describe('react app generator (legacy)', () => {
  let appTree: Tree;
  let schema: Schema = {
    compiler: 'babel',
    e2eTestRunner: 'cypress',
    skipFormat: false,
    directory: 'my-app',
    linter: 'eslint',
    style: 'css',
    strict: true,
    addPlugin: false,
  };
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof getInstalledCypressMajorVersion>
  > = getInstalledCypressMajorVersion as never;

  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should setup webpack config that is compatible without project targets', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'my-app',
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
          config.output.clean = true;
          return config;
        },
      );
      "
    `);
  });

  it('should not write a dev-server port that was never requested', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'default-app',
      bundler: 'webpack',
      skipFormat: true,
    });

    // @nx/webpack:dev-server already defaults to 4200; restating it here would be noise.
    expect(
      readProjectConfiguration(appTree, 'default-app').targets.serve.options
    ).not.toHaveProperty('port');
  });

  it('should write an explicitly requested port to the serve target', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'pinned-app',
      bundler: 'webpack',
      port: 4321,
      skipFormat: true,
    });

    expect(
      readProjectConfiguration(appTree, 'pinned-app').targets.serve.options.port
    ).toBe(4321);
  });

  it('should write port 0, which asks the dev server for a free port', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'ephemeral-app',
      bundler: 'webpack',
      port: 0,
      skipFormat: true,
    });

    // 0 is schema-valid and meaningful; a truthiness guard here would drop it and
    // silently serve on the executor's 4200.
    expect(
      readProjectConfiguration(appTree, 'ephemeral-app').targets.serve.options
        .port
    ).toBe(0);
  });

  it('should accept the deprecated devServerPort from programmatic callers', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'aliased-app',
      bundler: 'webpack',
      devServerPort: 4322,
      skipFormat: true,
    });

    expect(
      readProjectConfiguration(appTree, 'aliased-app').targets.serve.options
        .port
    ).toBe(4322);
  });

  it('should setup vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'my-vite-app',
      bundler: 'vite',
      skipFormat: true,
    });
    expect(
      appTree.read('my-vite-app/vite.config.mts', 'utf-8')
    ).toMatchSnapshot();
  });
});
