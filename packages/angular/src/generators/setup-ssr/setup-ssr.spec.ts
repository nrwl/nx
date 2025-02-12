import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  NxJsonConfiguration,
  readJson,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { PackageJson } from 'nx/src/utils/package-json';
import { backwardCompatibleVersions } from '../../utils/backward-compatible-versions';
import {
  angularDevkitVersion,
  angularVersion,
  expressVersion,
  typesExpressVersion,
} from '../../utils/versions';
import { generateTestApplication } from '../utils/testing';
import { setupSsr } from './setup-ssr';

describe('setupSSR', () => {
  describe('with application builder', () => {
    it('should create the files correctly for ssr', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, {
        directory: 'app1',
        standalone: false,
        skipFormat: true,
      });

      // ACT
      await setupSsr(tree, { project: 'app1' });

      // ASSERT
      expect(
        readProjectConfiguration(tree, 'app1').targets.build
      ).toMatchSnapshot();
      expect(tree.read('app1/src/server.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app1/src/main.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "export { AppServerModule as default } from './app/app.server.module';
        "
      `);
      expect(tree.read('app1/src/main.ts', 'utf-8')).toMatchInlineSnapshot(`
        "import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
        import { AppModule } from './app/app.module';

        platformBrowserDynamic()
          .bootstrapModule(AppModule, {
            ngZoneEventCoalescing: true,
          })
          .catch((err) => console.error(err));
        "
      `);
      expect(tree.exists('app1/tsconfig.server.json')).toBe(false);
      expect(readJson(tree, 'app1/tsconfig.app.json').files).toStrictEqual([
        'src/main.ts',
        'src/main.server.ts',
        'src/server.ts',
      ]);
      expect(tree.read('app1/src/app/app.server.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { ServerModule } from '@angular/platform-server';
        import { AppComponent } from './app.component';
        import { AppModule } from './app.module';

        @NgModule({
          imports: [AppModule, ServerModule],
          bootstrap: [AppComponent],
        })
        export class AppServerModule {}
        "
      `);
      expect(tree.read('app1/src/app/app.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import {
          BrowserModule,
          provideClientHydration,
          withEventReplay,
        } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';
        import { appRoutes } from './app.routes';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @NgModule({
          declarations: [AppComponent, NxWelcomeComponent],
          imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
          providers: [provideClientHydration(withEventReplay())],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
        "
      `);
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults.server).toBeUndefined();
    });

    it('should create the files correctly for ssr when app is standalone', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, {
        directory: 'app1',
        skipFormat: true,
      });

      // ACT
      await setupSsr(tree, { project: 'app1' });

      // ASSERT
      expect(
        readProjectConfiguration(tree, 'app1').targets.build
      ).toMatchSnapshot();
      expect(tree.read('app1/src/server.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app1/src/main.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { bootstrapApplication } from '@angular/platform-browser';
        import { AppComponent } from './app/app.component';
        import { config } from './app/app.config.server';

        const bootstrap = () => bootstrapApplication(AppComponent, config);

        export default bootstrap;
        "
      `);
      expect(tree.exists('app1/tsconfig.server.json')).toBe(false);
      expect(readJson(tree, 'app1/tsconfig.app.json').files).toStrictEqual([
        'src/main.ts',
        'src/main.server.ts',
        'src/server.ts',
      ]);
      expect(tree.read('app1/src/app/app.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
        import { provideServerRendering } from '@angular/platform-server';
        import { appConfig } from './app.config';

        const serverConfig: ApplicationConfig = {
          providers: [provideServerRendering()],
        };

        export const config = mergeApplicationConfig(appConfig, serverConfig);
        "
      `);
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults.server).toBeUndefined();
    });

    it('should support object output option using a custom "outputPath.browser" and "outputPath.server" values', async () => {
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, {
        directory: 'app1',
        skipFormat: true,
      });
      const project = readProjectConfiguration(tree, 'app1');
      project.targets.build.options.outputPath = {
        base: project.targets.build.options.outputPath,
        browser: 'public',
        server: 'node-server',
      };
      updateProjectConfiguration(tree, 'app1', project);

      await setupSsr(tree, { project: 'app1' });

      const serverFileContent = tree.read('app1/src/server.ts', 'utf-8');
      expect(serverFileContent).toContain(
        `resolve(serverDistFolder, '../public')`
      );
    });

    it('should remove "outputPath.browser" when it is an empty string', async () => {
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, {
        directory: 'app1',
        skipFormat: true,
      });
      const project = readProjectConfiguration(tree, 'app1');
      project.targets.build.options.outputPath = {
        base: project.targets.build.options.outputPath,
        browser: '',
        server: 'node-server',
      };
      updateProjectConfiguration(tree, 'app1', project);

      await setupSsr(tree, { project: 'app1' });

      const updatedProject = readProjectConfiguration(tree, 'app1');
      expect(updatedProject.targets.build.options.outputPath).toStrictEqual({
        base: 'dist/app1',
        server: 'node-server',
      });
    });
  });

  describe('with browser builder', () => {
    it('should create the files correctly for ssr', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, {
        directory: 'app1',
        standalone: false,
        bundler: 'webpack',
        skipFormat: true,
      });

      // ACT
      await setupSsr(tree, { project: 'app1', skipFormat: true });

      // ASSERT
      expect(
        readProjectConfiguration(tree, 'app1').targets.server
      ).toMatchSnapshot();
      expect(tree.read('app1/src/server.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app1/src/main.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "export { AppServerModule as default } from './app/app.server.module';
        "
      `);
      expect(tree.read('app1/src/main.ts', 'utf-8')).toMatchInlineSnapshot(`
        "import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
        import { AppModule } from './app/app.module';

        platformBrowserDynamic()
          .bootstrapModule(AppModule, {
            ngZoneEventCoalescing: true
          })
          .catch((err) => console.error(err));
        "
      `);
      expect(tree.read('app1/tsconfig.server.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
        /* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
        {
          "extends": "./tsconfig.app.json",
          "compilerOptions": {
            "outDir": "../out-tsc/server",
            "types": [
              "node"
            ]
          },
          "files": [
            "src/main.server.ts",
            "src/server.ts"
          ]
        }
        "
      `);
      expect(tree.read('app1/src/app/app.server.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { ServerModule } from '@angular/platform-server';

        import { AppModule } from './app.module';
        import { AppComponent } from './app.component';

        @NgModule({
          imports: [
            AppModule,
            ServerModule,
          ],
          bootstrap: [AppComponent],
        })
        export class AppServerModule {}
        "
      `);
      expect(tree.read('app1/src/app/app.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { BrowserModule, provideClientHydration, withEventReplay } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';
        import { appRoutes } from './app.routes';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @NgModule({
          declarations: [AppComponent, NxWelcomeComponent],
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes),
          ],
          providers: [provideClientHydration(withEventReplay())],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
        "
      `);
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults.server.cache).toBe(true);
    });

    it('should create the files correctly for ssr when app is standalone', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, {
        directory: 'app1',
        bundler: 'webpack',
        skipFormat: true,
      });

      // ACT
      await setupSsr(tree, { project: 'app1', skipFormat: true });

      // ASSERT
      expect(
        readProjectConfiguration(tree, 'app1').targets.server
      ).toMatchSnapshot();
      expect(tree.read('app1/src/server.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app1/src/main.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { bootstrapApplication } from '@angular/platform-browser';
        import { AppComponent } from './app/app.component';
        import { config } from './app/app.config.server';

        const bootstrap = () => bootstrapApplication(AppComponent, config);

        export default bootstrap;
        "
      `);
      expect(tree.read('app1/tsconfig.server.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
        /* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
        {
          "extends": "./tsconfig.app.json",
          "compilerOptions": {
            "outDir": "../out-tsc/server",
            "types": [
              "node"
            ]
          },
          "files": [
            "src/main.server.ts",
            "src/server.ts"
          ]
        }
        "
      `);
      expect(tree.read('app1/src/app/app.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
        import { provideServerRendering } from '@angular/platform-server';
        import { appConfig } from './app.config';

        const serverConfig: ApplicationConfig = {
          providers: [
            provideServerRendering()
          ]
        };

        export const config = mergeApplicationConfig(appConfig, serverConfig);
        "
      `);
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults.server.cache).toEqual(true);
    });

    it('should update build target output path', async () => {
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, {
        directory: 'app1',
        standalone: false,
        bundler: 'webpack',
        skipFormat: true,
      });
      // verify default output path
      expect(
        readProjectConfiguration(tree, 'app1').targets.build.options.outputPath
      ).toBe('dist/app1');

      await setupSsr(tree, { project: 'app1', skipFormat: true });

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.options.outputPath
      ).toBe('dist/app1/browser');
    });
  });

  it('should install the correct dependencies', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, {
      directory: 'app1',
      skipFormat: true,
    });

    await setupSsr(tree, { project: 'app1', skipFormat: true });

    const { dependencies, devDependencies } = readJson<PackageJson>(
      tree,
      'package.json'
    );
    expect(dependencies['@angular/platform-server']).toEqual(angularVersion);
    expect(dependencies['@angular/ssr']).toEqual(angularDevkitVersion);
    expect(dependencies['express']).toEqual(expressVersion);
    expect(dependencies['@nguniversal/express-engine']).toBeUndefined();
    expect(devDependencies['@types/express']).toBe(typesExpressVersion);
    expect(devDependencies['@nguniversal/builders']).toBeUndefined();
  });

  it('should not touch the package.json when run with `--skipPackageJson`', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, {
      directory: 'app1',
      skipFormat: true,
    });
    let initialPackageJson;
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = {};
      json.devDependencies = {};
      initialPackageJson = json;

      return json;
    });

    await setupSsr(tree, {
      project: 'app1',
      skipFormat: true,
      skipPackageJson: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual(initialPackageJson);
  });

  it('should add hydration correctly for NgModule apps', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await generateTestApplication(tree, {
      directory: 'app1',
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await setupSsr(tree, {
      project: 'app1',
      hydration: true,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('app1/src/app/app.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { BrowserModule, provideClientHydration, withEventReplay } from '@angular/platform-browser';
      import { RouterModule } from '@angular/router';
      import { AppComponent } from './app.component';
      import { appRoutes } from './app.routes';
      import { NxWelcomeComponent } from './nx-welcome.component';

      @NgModule({
        declarations: [AppComponent, NxWelcomeComponent],
        imports: [
          BrowserModule,
          RouterModule.forRoot(appRoutes),
        ],
        providers: [provideClientHydration(withEventReplay())],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
      "
    `);
  });

  it('should add hydration correctly to standalone', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await generateTestApplication(tree, {
      directory: 'app1',
      skipFormat: true,
    });

    // ACT
    await setupSsr(tree, {
      project: 'app1',
      hydration: true,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('app1/src/app/app.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
      import { provideRouter } from '@angular/router';
      import { appRoutes } from './app.routes';
      import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

      export const appConfig: ApplicationConfig = {
        providers: [provideClientHydration(withEventReplay()),provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(appRoutes) ]
      };
      "
    `);

    expect(tree.read('app1/src/app/app.config.server.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
      import { provideServerRendering } from '@angular/platform-server';
      import { appConfig } from './app.config';

      const serverConfig: ApplicationConfig = {
        providers: [
          provideServerRendering()
        ]
      };

      export const config = mergeApplicationConfig(appConfig, serverConfig);
      "
    `);
  });

  it('should set "initialNavigation: enabledBlocking" in "RouterModule.forRoot" options when hydration=false', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, {
      directory: 'app1',
      standalone: false,
      skipFormat: true,
    });

    await setupSsr(tree, {
      project: 'app1',
      hydration: false,
      skipFormat: true,
    });

    expect(tree.read('app1/src/app/app.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { BrowserModule } from '@angular/platform-browser';
      import { RouterModule } from '@angular/router';
      import { AppComponent } from './app.component';
      import { appRoutes } from './app.routes';
      import { NxWelcomeComponent } from './nx-welcome.component';

      @NgModule({
        declarations: [AppComponent, NxWelcomeComponent],
        imports: [
          BrowserModule,
          RouterModule.forRoot(appRoutes, { initialNavigation: 'enabledBlocking' }),
        ],
        providers: [],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
      "
    `);
  });

  it('should set "withEnabledBlockingInitialNavigation()" in "provideRouter" features when hydration=false', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, {
      directory: 'app1',
      skipFormat: true,
    });

    await setupSsr(tree, {
      project: 'app1',
      hydration: false,
      skipFormat: true,
    });

    expect(tree.read('app1/src/app/app.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
      import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
      import { appRoutes } from './app.routes';

      export const appConfig: ApplicationConfig = {
        providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(appRoutes, withEnabledBlockingInitialNavigation()) ]
      };
      "
    `);
  });

  describe('compat', () => {
    it('should install the correct versions when using older versions of Angular', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          '@angular/core': '17.2.0',
        },
      }));
      await generateTestApplication(tree, {
        directory: 'app1',
        standalone: false,
        skipFormat: true,
      });

      // ACT
      await setupSsr(tree, { project: 'app1', skipFormat: true });

      // ASSERT
      const pkgJson = readJson(tree, 'package.json');
      expect(pkgJson.dependencies['@angular/ssr']).toBe(
        backwardCompatibleVersions.angularV17.angularDevkitVersion
      );
      expect(pkgJson.dependencies['@angular/platform-server']).toEqual(
        backwardCompatibleVersions.angularV17.angularVersion
      );
      expect(pkgJson.dependencies['@angular/ssr']).toEqual(
        backwardCompatibleVersions.angularV17.angularDevkitVersion
      );
      expect(pkgJson.dependencies['express']).toEqual(
        backwardCompatibleVersions.angularV17.expressVersion
      );
      expect(
        pkgJson.dependencies['@nguniversal/express-engine']
      ).toBeUndefined();
      expect(pkgJson.devDependencies['@types/express']).toBe(
        backwardCompatibleVersions.angularV17.typesExpressVersion
      );
      expect(pkgJson.devDependencies['@nguniversal/builders']).toBeUndefined();
    });

    it('should add hydration correctly for NgModule apps', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: { '@angular/core': '17.2.0' },
      }));
      await generateTestApplication(tree, {
        directory: 'app1',
        standalone: false,
        skipFormat: true,
      });

      await setupSsr(tree, {
        project: 'app1',
        hydration: true,
        skipFormat: true,
      });

      expect(tree.read('app1/src/app/app.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
        import { RouterModule } from '@angular/router';
        import { AppComponent } from './app.component';
        import { appRoutes } from './app.routes';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @NgModule({
          declarations: [AppComponent, NxWelcomeComponent],
          imports: [
            BrowserModule,
            RouterModule.forRoot(appRoutes),
          ],
          providers: [provideClientHydration()],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
        "
      `);
    });

    it('should add hydration correctly to standalone', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: { '@angular/core': '17.2.0' },
      }));
      await generateTestApplication(tree, {
        directory: 'app1',
        skipFormat: true,
      });

      await setupSsr(tree, {
        project: 'app1',
        hydration: true,
        skipFormat: true,
      });

      expect(tree.read('app1/src/app/app.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { ApplicationConfig } from '@angular/core';
        import { provideRouter } from '@angular/router';
        import { appRoutes } from './app.routes';
        import { provideClientHydration } from '@angular/platform-browser';

        export const appConfig: ApplicationConfig = {
          providers: [provideClientHydration(),provideRouter(appRoutes) ]
        };
        "
      `);

      expect(tree.read('app1/src/app/app.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
        import { provideServerRendering } from '@angular/platform-server';
        import { appConfig } from './app.config';

        const serverConfig: ApplicationConfig = {
          providers: [
            provideServerRendering()
          ]
        };

        export const config = mergeApplicationConfig(appConfig, serverConfig);
        "
      `);
    });
  });
});
