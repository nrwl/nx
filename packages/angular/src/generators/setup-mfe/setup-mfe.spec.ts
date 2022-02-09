import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
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
      routing: true,
    });
    await applicationGenerator(host, {
      name: 'remote1',
      routing: true,
    });
  });

  test.each([
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should create webpack configs correctly',
    async (app, type: 'host' | 'remote') => {
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
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'create bootstrap file with the contents of main.ts',
    async (app, type: 'host' | 'remote') => {
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
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should alter main.ts to import the bootstrap file dynamically',
    async (app, type: 'host' | 'remote') => {
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
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should change the build and serve target and set correct path to webpack config',
    async (app, type: 'host' | 'remote') => {
      // ACT
      await setupMfe(host, {
        appName: app,
        mfeType: type,
      });

      // ASSERT
      const { build, serve } = readProjectConfiguration(host, app).targets;

      expect(serve.executor).toEqual('@nrwl/angular:webpack-server');
      expect(build.executor).toEqual('@nrwl/angular:webpack-browser');
      expect(build.options.customWebpackConfig.path).toEqual(
        `apps/${app}/webpack.config.js`
      );
    }
  );

  test.each([
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should install @angular-architects/module-federation in the monorepo',
    async (app, type: 'host' | 'remote') => {
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

  it('should add the remote config to the host when --remotes flag supplied', async () => {
    // ACT
    await setupMfe(host, {
      appName: 'app1',
      mfeType: 'host',
      remotes: ['remote1'],
    });

    // ASSERT
    const webpackContents = host.read(`apps/app1/webpack.config.js`, 'utf-8');

    expect(webpackContents).toContain(
      '"remote1": "http://localhost:4200/remoteEntry.js"'
    );
  });
  it('should update the implicit dependencies of the host when --remotes flag supplied', async () => {
    // ACT
    await setupMfe(host, {
      appName: 'app1',
      mfeType: 'host',
      remotes: ['remote1'],
    });

    // ASSERT
    const projectConfig: ProjectConfiguration = readProjectConfiguration(
      host,
      'app1'
    );

    expect(projectConfig.implicitDependencies).toContain('remote1');
  });

  it('should add a remote application and add it to a specified host applications webpack config when no other remote has been added to it', async () => {
    // ARRANGE
    await setupMfe(host, {
      appName: 'app1',
      mfeType: 'host',
    });

    // ACT
    await setupMfe(host, {
      appName: 'remote1',
      mfeType: 'remote',
      host: 'app1',
    });

    // ASSERT
    const hostWebpackConfig = host.read('apps/app1/webpack.config.js', 'utf-8');
    expect(hostWebpackConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications webpack config that contains a remote application already', async () => {
    // ARRANGE
    await applicationGenerator(host, {
      name: 'remote2',
    });

    await setupMfe(host, {
      appName: 'app1',
      mfeType: 'host',
    });

    await setupMfe(host, {
      appName: 'remote1',
      mfeType: 'remote',
      host: 'app1',
      port: 4201,
    });

    // ACT
    await setupMfe(host, {
      appName: 'remote2',
      mfeType: 'remote',
      host: 'app1',
      port: 4202,
    });

    // ASSERT
    const hostWebpackConfig = host.read('apps/app1/webpack.config.js', 'utf-8');
    expect(hostWebpackConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications router config', async () => {
    // ARRANGE
    await applicationGenerator(host, {
      name: 'remote2',
      routing: true,
    });

    await setupMfe(host, {
      appName: 'app1',
      mfeType: 'host',
      routing: true,
    });

    await setupMfe(host, {
      appName: 'remote1',
      mfeType: 'remote',
      host: 'app1',
      port: 4201,
      routing: true,
    });

    // ACT
    await setupMfe(host, {
      appName: 'remote2',
      mfeType: 'remote',
      host: 'app1',
      port: 4202,
      routing: true,
    });

    // ASSERT
    const hostAppModule = host.read('apps/app1/src/app/app.module.ts', 'utf-8');
    expect(hostAppModule).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications serve-mfe target', async () => {
    // ARRANGE
    await applicationGenerator(host, {
      name: 'remote2',
      routing: true,
    });

    await setupMfe(host, {
      appName: 'app1',
      mfeType: 'host',
      routing: true,
    });

    await setupMfe(host, {
      appName: 'remote1',
      mfeType: 'remote',
      host: 'app1',
      port: 4201,
      routing: true,
    });

    // ACT
    await setupMfe(host, {
      appName: 'remote2',
      mfeType: 'remote',
      host: 'app1',
      port: 4202,
      routing: true,
    });

    // ASSERT
    const hostAppConfig = readProjectConfiguration(host, 'app1');
    const serveMfe = hostAppConfig.targets['serve-mfe'];

    expect(serveMfe.options.commands).toContain('nx serve remote1');
    expect(serveMfe.options.commands).toContain('nx serve remote2');
    expect(serveMfe.options.commands).toContain('nx serve app1');
  });

  it('should modify the associated cypress project to add the workaround correctly', async () => {
    // ARRANGE
    await applicationGenerator(host, {
      name: 'testApp',
      routing: true,
    });

    // ACT
    await setupMfe(host, {
      appName: 'test-app',
      mfeType: 'host',
      routing: true,
    });

    // ASSERT
    const cypressCommands = host.read(
      'apps/test-app-e2e/src/support/commands.ts',
      'utf-8'
    );
    expect(cypressCommands).toContain(
      "Cannot use 'import.meta' outside a module"
    );
  });
});
