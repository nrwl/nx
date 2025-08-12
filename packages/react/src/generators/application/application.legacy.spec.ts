import 'nx/src/internal-testing-utils/mock-project-graph';

import { getInstalledCypressMajorVersion } from '@nx/cypress/src/utils/versions';
import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from './application';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/versions', () => ({
  ...jest.requireActual('@nx/cypress/src/utils/versions'),
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
          return config;
        }
      );
      "
    `);
  });

  it('should setup vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'my-vite-app',
      bundler: 'vite',
      skipFormat: true,
    });
    expect(
      appTree.read('my-vite-app/vite.config.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  describe('--style tailwind', () => {
    it('should not generate any styles files', async () => {
      await applicationGenerator(appTree, { ...schema, style: 'tailwind' });

      expect(appTree.exists('my-app/src/app/app.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.spec.tsx')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.css')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.scss')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.module.css')).toBeFalsy();
      expect(appTree.exists('my-app/src/app/app.module.scss')).toBeFalsy();

      const content = appTree.read('my-app/src/app/app.tsx').toString();
      expect(content).toMatchSnapshot();
    });

    it.each`
      bundler
      ${'webpack'}
      ${'rspack'}
    `('should generate styles.css not styles.tailwind', async ({ bundler }) => {
      await applicationGenerator(appTree, {
        ...schema,
        style: 'tailwind',
        bundler,
      });

      // Should not have `styles.tailwind` in build options since it's not valid -- it needs to be styles.css.
      const projectConfig = readProjectConfiguration(appTree, 'my-app');
      expect(projectConfig.targets.build.options.styles).toEqual([
        'my-app/src/styles.css',
      ]);
    });
  });
});
