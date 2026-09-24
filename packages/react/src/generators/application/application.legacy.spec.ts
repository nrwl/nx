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
    expect(targets.build).toBeUndefined();
    expect(targets.serve).toBeUndefined();
    const webpackConfig = appTree.read('my-app/webpack.config.js', 'utf-8');
    expect(webpackConfig).toContain('NxAppWebpackPlugin');
    expect(webpackConfig).not.toContain('composePlugins');
  });

  it('should not write a dev-server port that was never requested', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'default-app',
      bundler: 'webpack',
      skipFormat: true,
    });

    expect(
      readProjectConfiguration(appTree, 'default-app').targets.serve
    ).toBeUndefined();
    expect(appTree.read('default-app/webpack.config.js', 'utf-8')).toContain(
      'port: 4200'
    );
  });

  it('should write an explicitly requested port to the config', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'pinned-app',
      bundler: 'webpack',
      port: 4321,
      skipFormat: true,
    });

    expect(appTree.read('pinned-app/webpack.config.js', 'utf-8')).toContain(
      'port: 4321'
    );
  });

  it('should write port 0, which asks the dev server for a free port', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'ephemeral-app',
      bundler: 'webpack',
      port: 0,
      skipFormat: true,
    });

    expect(appTree.read('ephemeral-app/webpack.config.js', 'utf-8')).toContain(
      'port: 0'
    );
  });

  it('should accept the deprecated devServerPort from programmatic callers', async () => {
    await applicationGenerator(appTree, {
      ...schema,
      directory: 'aliased-app',
      bundler: 'webpack',
      devServerPort: 4322,
      skipFormat: true,
    });

    expect(appTree.read('aliased-app/webpack.config.js', 'utf-8')).toContain(
      'port: 4322'
    );
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
