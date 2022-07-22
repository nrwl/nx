import { readJson, readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { setupMf } from './setup-mf';
import applicationGenerator from '../application/application';

describe('Init MF', () => {
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
    'should create webpack and mf configs correctly',
    async (app, type: 'host' | 'remote') => {
      // ACT
      await setupMf(tree, {
        appName: app,
        mfType: type,
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

      const mfConfigContents = tree.read(
        `apps/${app}/module-federation.config.js`,
        'utf-8'
      );
      expect(mfConfigContents).toMatchSnapshot();
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
      await setupMf(tree, {
        appName: app,
        mfType: type,
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
      await setupMf(tree, {
        appName: app,
        mfType: type,
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
      await setupMf(tree, {
        appName: app,
        mfType: type,
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

  it('should generate the remote entry module and component correctly', async () => {
    // ACT
    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      prefix: 'my-org',
    });

    // ASSERT
    expect(
      tree.read('apps/remote1/src/app/remote-entry/entry.component.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('apps/remote1/src/app/remote-entry/entry.module.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate the remote entry component correctly when prefix is not provided', async () => {
    // ACT
    await setupMf(tree, { appName: 'remote1', mfType: 'remote' });

    // ASSERT
    expect(
      tree.read('apps/remote1/src/app/remote-entry/entry.component.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should add the remote config to the host when --remotes flag supplied', async () => {
    // ACT
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      remotes: ['remote1'],
    });

    // ASSERT
    const mfConfigContents = tree.read(
      `apps/app1/module-federation.config.js`,
      'utf-8'
    );

    expect(mfConfigContents).toContain(`'remote1'`);
  });

  it('should add a remote application and add it to a specified host applications webpack config when no other remote has been added to it', async () => {
    // ARRANGE
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      host: 'app1',
    });

    // ASSERT
    const hostMfConfig = tree.read(
      'apps/app1/module-federation.config.js',
      'utf-8'
    );
    expect(hostMfConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications webpack config that contains a remote application already', async () => {
    // ARRANGE
    await applicationGenerator(tree, {
      name: 'remote2',
    });

    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
    });

    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      host: 'app1',
      port: 4201,
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote2',
      mfType: 'remote',
      host: 'app1',
      port: 4202,
    });

    // ASSERT
    const hostMfConfig = tree.read(
      'apps/app1/module-federation.config.js',
      'utf-8'
    );
    expect(hostMfConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications router config', async () => {
    // ARRANGE
    await applicationGenerator(tree, {
      name: 'remote2',
      routing: true,
    });

    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      routing: true,
    });

    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      host: 'app1',
      port: 4201,
      routing: true,
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote2',
      mfType: 'remote',
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
    await setupMf(tree, {
      appName: 'test-app',
      mfType: 'host',
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
      await setupMf(tree, {
        appName: 'app1',
        mfType: 'host',
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
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      routing: true,
      federationType: 'dynamic',
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
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
