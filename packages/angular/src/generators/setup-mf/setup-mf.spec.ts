import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { generateTestApplication } from '../utils/testing';
import { setupMf } from './setup-mf';

describe('Init MF', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, {
      name: 'app1',
      routing: true,
    });
    await generateTestApplication(tree, {
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
        typescriptConfiguration: false,
      });

      // ASSERT
      expect(tree.exists(`${app}/module-federation.config.js`)).toBeTruthy();
      expect(tree.exists(`${app}/webpack.config.js`)).toBeTruthy();
      expect(tree.exists(`${app}/webpack.prod.config.js`)).toBeTruthy();

      const webpackContents = tree.read(`${app}/webpack.config.js`, 'utf-8');
      expect(webpackContents).toMatchSnapshot();

      const mfConfigContents = tree.read(
        `${app}/module-federation.config.js`,
        'utf-8'
      );
      expect(mfConfigContents).toMatchSnapshot();
    }
  );

  test.each([
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should create webpack and mf configs correctly when --typescriptConfiguration=true',
    async (app, type: 'host' | 'remote') => {
      // ACT
      await setupMf(tree, {
        appName: app,
        mfType: type,
        typescriptConfiguration: true,
      });

      // ASSERT
      expect(tree.exists(`${app}/module-federation.config.ts`)).toBeTruthy();
      expect(tree.exists(`${app}/webpack.config.ts`)).toBeTruthy();
      expect(tree.exists(`${app}/webpack.prod.config.ts`)).toBeTruthy();

      const webpackContents = tree.read(`${app}/webpack.config.ts`, 'utf-8');
      expect(webpackContents).toMatchSnapshot();

      const mfConfigContents = tree.read(
        `${app}/module-federation.config.ts`,
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
      const mainContents = tree.read(`${app}/src/main.ts`, 'utf-8');

      // ACT
      await setupMf(tree, {
        appName: app,
        mfType: type,
      });

      // ASSERT
      const bootstrapContents = tree.read(`${app}/src/bootstrap.ts`, 'utf-8');
      const updatedMainContents = tree.read(`${app}/src/main.ts`, 'utf-8');

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
      const mainContents = tree.read(`${app}/src/main.ts`, 'utf-8');

      // ACT
      await setupMf(tree, {
        appName: app,
        mfType: type,
      });

      // ASSERT
      const updatedMainContents = tree.read(`${app}/src/main.ts`, 'utf-8');

      expect(updatedMainContents).toEqual(
        `import('./bootstrap').catch((err) => console.error(err));\n`
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
        typescriptConfiguration: false,
      });

      // ASSERT
      const { build, serve } = readProjectConfiguration(tree, app).targets;

      expect(serve.executor).toEqual(
        type === 'host'
          ? '@nx/angular:module-federation-dev-server'
          : '@nx/angular:webpack-dev-server'
      );
      expect(build.executor).toEqual('@nx/angular:webpack-browser');
      expect(build.options.customWebpackConfig.path).toEqual(
        `${app}/webpack.config.js`
      );
    }
  );

  test.each([
    ['app1', 'host'],
    ['remote1', 'remote'],
  ])(
    'should change the build and serve target and set correct path to webpack config when --typescriptConfiguration=true',
    async (app, type: 'host' | 'remote') => {
      // ACT
      await setupMf(tree, {
        appName: app,
        mfType: type,
        typescriptConfiguration: true,
      });

      // ASSERT
      const { build, serve } = readProjectConfiguration(tree, app).targets;

      expect(serve.executor).toEqual(
        type === 'host'
          ? '@nx/angular:module-federation-dev-server'
          : '@nx/angular:webpack-dev-server'
      );
      expect(build.executor).toEqual('@nx/angular:webpack-browser');
      expect(build.options.customWebpackConfig.path).toEqual(
        `${app}/webpack.config.ts`
      );
    }
  );

  it('should not generate a webpack prod file for dynamic host', async () => {
    // ACT
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      federationType: 'dynamic',
    });

    // ASSERT
    const { build } = readProjectConfiguration(tree, 'app1').targets;
    expect(tree.exists('app1/webpack.prod.config.ts')).toBeFalsy();
    expect(build.configurations.production.customWebpackConfig).toBeUndefined();
  });

  it('should generate the remote entry module and component correctly', async () => {
    // ACT
    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      prefix: 'my-org',
    });

    // ASSERT
    expect(
      tree.read('remote1/src/app/remote-entry/entry.component.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('remote1/src/app/remote-entry/entry.module.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate the remote entry component correctly when prefix is not provided', async () => {
    // ACT
    await setupMf(tree, { appName: 'remote1', mfType: 'remote' });

    // ASSERT
    expect(
      tree.read('remote1/src/app/remote-entry/entry.component.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should add the remote config to the host when --remotes flag supplied', async () => {
    // ACT
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      remotes: ['remote1'],
      typescriptConfiguration: false,
    });

    // ASSERT
    const mfConfigContents = tree.read(
      `app1/module-federation.config.js`,
      'utf-8'
    );

    expect(mfConfigContents).toContain(`'remote1'`);
  });

  it('should add the remote config to the host when --remotes flag supplied when --typescriptConfiguration=true', async () => {
    // ACT
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      remotes: ['remote1'],
      typescriptConfiguration: true,
    });

    // ASSERT
    const mfConfigContents = tree.read(
      `app1/module-federation.config.ts`,
      'utf-8'
    );

    expect(mfConfigContents).toContain(`'remote1'`);
  });

  it('should add a remote application and add it to a specified host applications webpack config when no other remote has been added to it', async () => {
    // ARRANGE
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      typescriptConfiguration: false,
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      host: 'app1',
      typescriptConfiguration: false,
    });

    // ASSERT
    const hostMfConfig = tree.read('app1/module-federation.config.js', 'utf-8');
    expect(hostMfConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications webpack config when no other remote has been added to it when --typescriptConfiguration=true', async () => {
    // ARRANGE
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      typescriptConfiguration: true,
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      host: 'app1',
      typescriptConfiguration: true,
    });

    // ASSERT
    const hostMfConfig = tree.read('app1/module-federation.config.ts', 'utf-8');
    expect(hostMfConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications webpack config that contains a remote application already', async () => {
    // ARRANGE
    await generateTestApplication(tree, {
      name: 'remote2',
    });

    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      typescriptConfiguration: false,
    });

    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      host: 'app1',
      port: 4201,
      typescriptConfiguration: false,
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote2',
      mfType: 'remote',
      host: 'app1',
      port: 4202,
      typescriptConfiguration: false,
    });

    // ASSERT
    const hostMfConfig = tree.read('app1/module-federation.config.js', 'utf-8');
    expect(hostMfConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications webpack config that contains a remote application already when --typescriptConfiguration=true', async () => {
    // ARRANGE
    await generateTestApplication(tree, {
      name: 'remote2',
    });

    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      typescriptConfiguration: true,
    });

    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      host: 'app1',
      port: 4201,
      typescriptConfiguration: true,
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote2',
      mfType: 'remote',
      host: 'app1',
      port: 4202,
      typescriptConfiguration: true,
    });

    // ASSERT
    const hostMfConfig = tree.read('app1/module-federation.config.ts', 'utf-8');
    expect(hostMfConfig).toMatchSnapshot();
  });

  it('should add a remote application and add it to a specified host applications router config', async () => {
    // ARRANGE
    await generateTestApplication(tree, {
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
    const hostAppRoutes = tree.read('app1/src/app/app.routes.ts', 'utf-8');
    expect(hostAppRoutes).toMatchSnapshot();
  });

  it('should modify the associated cypress project to add the workaround correctly', async () => {
    // ARRANGE
    await generateTestApplication(tree, {
      name: 'test-app',
      routing: true,
    });

    // ACT
    await setupMf(tree, {
      appName: 'test-app',
      mfType: 'host',
      routing: true,
      e2eProjectName: 'test-app-e2e',
    });

    // ASSERT
    const cypressCommands = tree.read(
      'test-app-e2e/src/support/e2e.ts',
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
        typescriptConfiguration: false,
      });

      // ASSERT
      expect(tree.read('app1/module-federation.config.js', 'utf-8')).toContain(
        'remotes: []'
      );
      expect(
        tree.exists('app1/src/assets/module-federation.manifest.json')
      ).toBeTruthy();
      expect(tree.read('app1/src/main.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should create a host with the correct configurations when --typescriptConfiguration=true', async () => {
      // ARRANGE & ACT
      await setupMf(tree, {
        appName: 'app1',
        mfType: 'host',
        routing: true,
        federationType: 'dynamic',
        typescriptConfiguration: true,
      });

      // ASSERT
      expect(tree.read('app1/module-federation.config.ts', 'utf-8')).toContain(
        'remotes: []'
      );
      expect(
        tree.exists('app1/src/assets/module-federation.manifest.json')
      ).toBeTruthy();
      expect(tree.read('app1/src/main.ts', 'utf-8')).toMatchSnapshot();
    });
  });

  it('should generate bootstrap with environments for ng14', async () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/core': '14.1.0',
      },
    }));

    await generateTestApplication(tree, {
      name: 'ng14',
      routing: true,
      standalone: true,
    });

    // ACT
    await setupMf(tree, {
      appName: 'ng14',
      mfType: 'host',
      routing: true,
      standalone: true,
    });

    // ASSERT
    expect(tree.read('ng14/src/bootstrap.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { bootstrapApplication } from '@angular/platform-browser';
      import { appConfig } from './app/app.config';
      import { AppComponent } from './app/app.component';
      import { enableProdMode } from '@angular/core';
      import { environment } from './environments/environment';

      if (environment.production) {
        enableProdMode();
      }

      bootstrapApplication(AppComponent, appConfig).catch((err) =>
        console.error(err)
      );
      "
    `);
  });

  it('should add a remote to dynamic host correctly', async () => {
    // ARRANGE
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      routing: true,
      federationType: 'dynamic',
      typescriptConfiguration: false,
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      port: 4201,
      host: 'app1',
      routing: true,
      typescriptConfiguration: false,
    });

    // ASSERT
    expect(tree.read('app1/module-federation.config.js', 'utf-8')).toContain(
      'remotes: []'
    );
    expect(
      readJson(tree, 'app1/src/assets/module-federation.manifest.json')
    ).toEqual({
      remote1: 'http://localhost:4201',
    });
    expect(tree.read('app1/src/app/app.routes.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should add a remote to dynamic host correctly when --typescriptConfiguration=true', async () => {
    // ARRANGE
    await setupMf(tree, {
      appName: 'app1',
      mfType: 'host',
      routing: true,
      federationType: 'dynamic',
      typescriptConfiguration: true,
    });

    // ACT
    await setupMf(tree, {
      appName: 'remote1',
      mfType: 'remote',
      port: 4201,
      host: 'app1',
      routing: true,
      typescriptConfiguration: true,
    });

    // ASSERT
    expect(tree.read('app1/module-federation.config.ts', 'utf-8')).toContain(
      'remotes: []'
    );
    expect(
      readJson(tree, 'app1/src/assets/module-federation.manifest.json')
    ).toEqual({
      remote1: 'http://localhost:4201',
    });
    expect(tree.read('app1/src/app/app.routes.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should throw an error when installed version of angular < 14.1.0 and --standalone is used', async () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/core': '14.0.0',
      },
    }));

    // ACT & ASSERT
    await expect(
      setupMf(tree, {
        appName: 'app1',
        mfType: 'host',
        standalone: true,
      })
    ).rejects.toThrow(
      'The --standalone flag is not supported in your current version of Angular (14.0.0). Please update to a version of Angular that supports Standalone Components (>= 14.1.0).'
    );
  });
});
