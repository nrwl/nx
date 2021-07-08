import type { NxJsonConfiguration, Tree } from '@nrwl/devkit';
import { readJson, readProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { setupMfe } from './setup-mfe';
import applicationGenerator from '../application/application';
describe('Init MFE', () => {
  let host: Tree;

  beforeEach(async () => {
    host = createTreeWithEmptyWorkspace();
    await applicationGenerator(host, {
      name: 'app1',
    });
    await applicationGenerator(host, {
      name: 'remote1',
    });
  });

  test.each([
    ['app1', 'shell'],
    ['remote1', 'remote'],
  ])(
    'should create webpack configs correctly',
    async (app, type: 'shell' | 'remote') => {
      // ACT
      await setupMfe(host, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      expect(host.exists(`apps/${app}/webpack.config.js`)).toBeTruthy();
      expect(host.exists(`apps/${app}/webpack.prod.config.js`)).toBeTruthy();

      const webpackContetnts = host.read(
        `apps/${app}/webpack.config.js`,
        'utf-8'
      );
      expect(webpackContetnts).toMatchSnapshot();
    }
  );

  test.each([
    ['app1', 'shell'],
    ['remote1', 'remote'],
  ])(
    'create bootstrap file with the contents of main.ts',
    async (app, type: 'shell' | 'remote') => {
      // ARRANGE
      const mainContents = host.read(`apps/${app}/src/main.ts`, 'utf-8');

      // ACT
      await setupMfe(host, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const bootstrapContents = host.read(
        `apps/${app}/src/bootstrap.ts`,
        'utf-8'
      );
      const updatedMainContents = host.read(`apps/${app}/src/main.ts`, 'utf-8');

      expect(bootstrapContents).toEqual(mainContents);
      expect(updatedMainContents).not.toEqual(mainContents);
    }
  );

  test.each([
    ['app1', 'shell'],
    ['remote1', 'remote'],
  ])(
    'should alter main.ts to import the bootstrap file dynamically',
    async (app, type: 'shell' | 'remote') => {
      // ARRANGE
      const mainContents = host.read(`apps/${app}/src/main.ts`, 'utf-8');

      // ACT
      await setupMfe(host, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const updatedMainContents = host.read(`apps/${app}/src/main.ts`, 'utf-8');

      expect(updatedMainContents).toEqual(
        `import('./bootstrap').catch(err => console.error(err));`
      );
      expect(updatedMainContents).not.toEqual(mainContents);
    }
  );

  test.each([
    ['app1', 'shell'],
    ['remote1', 'remote'],
  ])(
    'should change the build target and set correct path to webpack config',
    async (app, type: 'shell' | 'remote') => {
      // ACT
      await setupMfe(host, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const { build } = readProjectConfiguration(host, app).targets;

      expect(build.executor).toEqual('@nrwl/angular:webpack-browser');
      expect(build.options.customWebpackConfig.path).toEqual(
        `apps/${app}/webpack.config.js`
      );
    }
  );

  test.each([
    ['app1', 'shell'],
    ['remote1', 'remote'],
  ])(
    'should change the serve target to nrwl/web:file-server',
    async (app, type: 'shell' | 'remote') => {
      // ACT
      await setupMfe(host, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const { serve } = readProjectConfiguration(host, app).targets;

      expect(serve.executor).toEqual('@nrwl/web:file-server');
      expect(serve.configurations.development.buildTarget).toEqual(
        `${app}:build:development`
      );
      expect(serve.configurations.production.buildTarget).toEqual(
        `${app}:build:production`
      );
    }
  );

  test.each([
    ['app1', 'shell'],
    ['remote1', 'remote'],
  ])(
    'should install @angular-architects/module-federation in the monorepo',
    async (app, type: 'shell' | 'remote') => {
      // ACT
      await setupMfe(host, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const { dependencies } = readJson(host, 'package.json');

      expect(
        dependencies['@angular-architects/module-federation']
      ).toBeTruthy();
    }
  );

  it('should add the remote config to the shell when --remotes flag supplied', async () => {
    // ACT
    await setupMfe(host, {
      appName: 'app1',
      mfeType: 'shell',
      remotes: ['remote1'],
    });

    // ASSERT
    const webpackContents = host.read(`apps/app1/webpack.config.js`, 'utf-8');

    expect(webpackContents).toContain(
      '"remote1": "remote1@http://localhost:4200/remoteEntry.js"'
    );
  });
  it('should update the implicit dependencies of the shell when --remotes flag supplied', async () => {
    // ACT
    await setupMfe(host, {
      appName: 'app1',
      mfeType: 'shell',
      remotes: ['remote1'],
    });

    // ASSERT
    const nxJson: NxJsonConfiguration = readJson(host, 'nx.json');

    expect(nxJson.projects['app1'].implicitDependencies).toContain('remote1');
  });
});
