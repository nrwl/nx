import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  getProjects,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
} from '@nx/devkit';
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
describe('web app generator (PCv3)', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push('@nx/webpack/plugin');
    nxJson.plugins.push('@nx/vite/plugin');
    updateNxJson(tree, nxJson);
  });

  it('should setup webpack configuration', async () => {
    await applicationGenerator(tree, {
      name: 'my-app',
      projectNameAndRootFormat: 'as-provided',
    });
    const targets = readProjectConfiguration(tree, 'my-app').targets;
    expect(targets.build).toBeUndefined();
    expect(targets.serve).toBeUndefined();

    const webpackConfig = tree.read('my-app/webpack.config.js', 'utf-8');
    expect(webpackConfig).toContain(`new NxWebpackPlugin`);
    expect(webpackConfig).toContain(`'../dist/my-app'`);
    expect(webpackConfig).toContain(`main: './src/main.ts'`);
    expect(webpackConfig).toContain(`tsConfig: './tsconfig.app.json'`);
    expect(webpackConfig).toContain(`styles: ['./src/styles.css']`);
    expect(webpackConfig).toContain(
      `assets: ['./src/favicon.ico', './src/assets']`
    );
  });

  it('should not add targets for vite', async () => {
    await applicationGenerator(tree, {
      name: 'my-vite-app',
      bundler: 'vite',
    });
    const projects = getProjects(tree);
    expect(projects.get('my-vite-app').targets.build).toBeUndefined();
    expect(projects.get('my-vite-app').targets.serve).toBeUndefined();
    expect(projects.get('my-vite-app').targets.preview).toBeUndefined();
    expect(projects.get('my-vite-app').targets.test).toBeUndefined();
  });
});
