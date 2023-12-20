import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  getProjects,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { applicationGenerator } from './application';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
describe('react app generator (PCv3)', () => {
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
  };
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    appTree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(appTree);
    nxJson.plugins ??= [];
    nxJson.plugins.push('@nx/webpack/plugin');
    nxJson.plugins.push('@nx/vite/plugin');
    updateNxJson(appTree, nxJson);
  });

  it('should setup webpack config that is compatible without project targets', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-app',
      bundler: 'webpack',
    });

    const targets = readProjectConfiguration(appTree, 'my-app').targets;
    expect(targets.build).toBeUndefined();
    expect(targets.serve).toBeUndefined();

    const webpackConfig = appTree.read('my-app/webpack.config.js', 'utf-8');
    expect(webpackConfig).toContain(`new NxWebpackPlugin`);
    expect(webpackConfig).toContain(`'../dist/my-app'`);
    expect(webpackConfig).toContain(`main: './src/main.tsx'`);
    expect(webpackConfig).toContain(`tsConfig: './tsconfig.app.json'`);
    expect(webpackConfig).toContain(`styles: ['./src/styles.css']`);
    expect(webpackConfig).toContain(
      `assets: ['./src/favicon.ico', './src/assets']`
    );
  });

  it('should not add targets for vite', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      name: 'my-vite-app',
      bundler: 'vite',
      skipFormat: true,
    });
    const projects = getProjects(appTree);
    expect(projects.get('my-vite-app').targets.build).toBeUndefined();
    expect(projects.get('my-vite-app').targets.serve).toBeUndefined();
    expect(projects.get('my-vite-app').targets.preview).toBeUndefined();
    expect(projects.get('my-vite-app').targets.test).toBeUndefined();
  });
});
