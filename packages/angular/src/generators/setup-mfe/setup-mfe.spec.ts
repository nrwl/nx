import { readJson, Tree } from '@nrwl/devkit';
import { readProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { setupMfe } from './setup-mfe';
import applicationGenerator from '../application/application';
describe('Init MFE', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, {
      name: 'app1',
      routing: true,
    });
    await applicationGenerator(tree, {
      name: 'remote1',
      routing: true,
    });
  });

  test.each([
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should create webpack and mfe configs correctly',
    async (app, type: 'host' | 'remote') => {
      // ACT
      await setupMfe(tree, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      expect(
        tree.exists(`apps/${app}/module-federation.config.js`)
      ).toBeTruthy();
      expect(tree.exists(`apps/${app}/webpack.config.js`)).toBeTruthy();
      expect(tree.exists(`apps/${app}/webpack.prod.config.js`)).toBeTruthy();

      const webpackContents = tree.read(
        `apps/${app}/webpack.config.js`,
        'utf-8'
      );
      expect(webpackContents).toMatchSnapshot();

      const mfeConfigContents = tree.read(
        `apps/${app}/module-federation.config.js`,
        'utf-8'
      );
      expect(mfeConfigContents).toMatchSnapshot();
    }
  );

  test.each([
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'create bootstrap file with the contents of main.ts',
    async (app, type: 'host' | 'remote') => {
      // ARRANGE
      const mainContents = tree.read(`apps/${app}/src/main.ts`, 'utf-8');

      // ACT
      await setupMfe(tree, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const bootstrapContents = tree.read(
        `apps/${app}/src/bootstrap.ts`,
        'utf-8'
      );
      const updatedMainContents = tree.read(`apps/${app}/src/main.ts`, 'utf-8');

      expect(bootstrapContents).toEqual(mainContents);
      expect(updatedMainContents).not.toEqual(mainContents);
    }
  );

  test.each([
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should alter main.ts to import the bootstrap file dynamically',
    async (app, type: 'host' | 'remote') => {
      // ARRANGE
      const mainContents = tree.read(`apps/${app}/src/main.ts`, 'utf-8');

      // ACT
      await setupMfe(tree, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const updatedMainContents = tree.read(`apps/${app}/src/main.ts`, 'utf-8');

      expect(updatedMainContents).toEqual(
        `import('./bootstrap').catch(err => console.error(err))`
      );
      expect(updatedMainContents).not.toEqual(mainContents);
    }
  );

  test.each([
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should change the build and serve target and set correct path to webpack config',
    async (app, type: 'host' | 'remote') => {
      // ACT
      await setupMfe(tree, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const { build, serve } = readProjectConfiguration(tree, app).targets;

      expect(serve.executor).toEqual(
        type === 'host'
          ? '@nrwl/angular:module-federation-dev-server'
          : '@nrwl/angular:webpack-server'
      );
      expect(build.executor).toEqual('@nrwl/angular:webpack-browser');
      expect(build.options.customWebpackConfig.path).toEqual(
        `apps/${app}/webpack.config.js`
      );
    }
  );

  it('should add the remote config to the host when --remotes flag supplied', async () => {
    // ACT
    await setupMfe(tree, {
      appName: 'app1',
      mfeType: 'host',
      remotes: ['remote1'],
    });

    // ASSERT
    const mfeConfigContents = tree.read(
      `apps/app1/module-federation.config.js`,
      'utf-8'
    );

    expect(mfeConfigContents).toContain(`'remote1'`);
  });

  it('should add a remote application and add it to a specified host applications webpack config when no other remote has been added to it', async () => {
    // ARRANGE
    await setupMfe(tree, {
      appName: 'app1',
      mfeType: 'host',
    });

    // ACT
    await setupMfe(tree, {
      appName: 'remote1',
      mfeType: 'remote',
      host: 'app1',
    });

    // ASSERT
    const hostMfeConfig = tree.read(
      'apps/app1/module-federation.config.js',
      'utf-8'
    );
    expect(hostMfeConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications webpack config that contains a remote application already', async () => {
    // ARRANGE
    await applicationGenerator(tree, {
      name: 'remote2',
    });

    await setupMfe(tree, {
      appName: 'app1',
      mfeType: 'host',
    });

    await setupMfe(tree, {
      appName: 'remote1',
      mfeType: 'remote',
      host: 'app1',
      port: 4201,
    });

    // ACT
    await setupMfe(tree, {
      appName: 'remote2',
      mfeType: 'remote',
      host: 'app1',
      port: 4202,
    });

    // ASSERT
    const hostMfeConfig = tree.read(
      'apps/app1/module-federation.config.js',
      'utf-8'
    );
    expect(hostMfeConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications router config', async () => {
    // ARRANGE
    await applicationGenerator(tree, {
      name: 'remote2',
      routing: true,
    });

    await setupMfe(tree, {
      appName: 'app1',
      mfeType: 'host',
      routing: true,
    });

    await setupMfe(tree, {
      appName: 'remote1',
      mfeType: 'remote',
      host: 'app1',
      port: 4201,
      routing: true,
    });

    // ACT
    await setupMfe(tree, {
      appName: 'remote2',
      mfeType: 'remote',
      host: 'app1',
      port: 4202,
      routing: true,
    });

    // ASSERT
    const hostAppModule = tree.read('apps/app1/src/app/app.module.ts', 'utf-8');
    expect(hostAppModule).toMatchSnapshot();
  });

  it('should modify the associated cypress project to add the workaround correctly', async () => {
    // ARRANGE
    await applicationGenerator(tree, {
      name: 'testApp',
      routing: true,
    });

    // ACT
    await setupMfe(tree, {
      appName: 'test-app',
      mfeType: 'host',
      routing: true,
    });

    // ASSERT
    const cypressCommands = tree.read(
      'apps/test-app-e2e/src/support/index.ts',
      'utf-8'
    );
    expect(cypressCommands).toContain(
      "Cannot use 'import.meta' outside a module"
    );
  });

  describe('--federationType=dynamic', () => {
    it('should create a host with the correct configurations', async () => {
      // ARRANGE & ACT
      await setupMfe(tree, {
        appName: 'app1',
        mfeType: 'host',
        routing: true,
        federationType: 'dynamic',
      });

      // ASSERT
      expect(
        tree.read('apps/app1/module-federation.config.js', 'utf-8')
      ).toContain('remotes: []');
      expect(
        tree.exists('apps/app1/src/assets/module-federation.manifest.json')
      ).toBeTruthy();
      expect(tree.read('apps/app1/src/main.ts', 'utf-8')).toMatchSnapshot();
    });
  });

  it('should add a remote to dynamic host correctly', async () => {
    // ARRANGE
    await setupMfe(tree, {
      appName: 'app1',
      mfeType: 'host',
      routing: true,
      federationType: 'dynamic',
    });

    // ACT
    await setupMfe(tree, {
      appName: 'remote1',
      mfeType: 'remote',
      port: 4201,
      host: 'app1',
      routing: true,
    });

    // ASSERT
    expect(
      tree.read('apps/app1/module-federation.config.js', 'utf-8')
    ).toContain('remotes: []');
    expect(
      readJson(tree, 'apps/app1/src/assets/module-federation.manifest.json')
    ).toEqual({
      remote1: 'http://localhost:4201',
    });
    expect(
      tree.read('apps/app1/src/app/app.module.ts', 'utf-8')
    ).toMatchSnapshot();
  });
});
