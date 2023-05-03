import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { dirname } from 'path';
import { backwardCompatibleVersions } from '../../utils/backward-compatible-versions';
import {
  AppConfig,
  createApp,
  createLib,
  getAppConfig,
  getLibConfig,
} from '../../utils/nx-devkit/testing';
import { ngrxVersion } from '../../utils/versions';
import { generateTestApplication } from '../utils/testing';
import { ngrxGenerator } from './ngrx';
import type { NgRxGeneratorOptions } from './schema';

describe('ngrx', () => {
  let appConfig: AppConfig;
  let statePath: string;
  let tree: Tree;

  const defaultOptions: NgRxGeneratorOptions = {
    directory: '+state',
    minimal: true,
    parent: 'apps/myapp/src/app/app.module.ts',
    name: 'users',
  };

  const defaultStandaloneOptions: NgRxGeneratorOptions = {
    directory: '+state',
    minimal: true,
    parent: 'apps/my-app/src/app/app.config.ts',
    name: 'users',
  };

  const defaultModuleOptions: NgRxGeneratorOptions = {
    directory: '+state',
    minimal: true,
    module: 'apps/myapp/src/app/app.module.ts',
    name: 'users',
  };

  const expectFileToExist = (file: string) =>
    expect(tree.exists(file)).toBeTruthy();
  const expectFileToNotExist = (file: string) =>
    expect(tree.exists(file)).not.toBeTruthy();

  describe('NgModule Syntax', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      createApp(tree, 'myapp');
      appConfig = getAppConfig();
      statePath = `${dirname(appConfig.appModule)}/+state`;
    });

    it('should error when the module could not be found', async () => {
      const modulePath = 'not-existing.module.ts';

      await expect(
        ngrxGenerator(tree, {
          ...defaultOptions,
          module: modulePath,
        })
      ).rejects.toThrowError(`Module does not exist: ${modulePath}.`);
    });

    it('should error when the module could not be found using --module', async () => {
      const modulePath = 'not-existing.module.ts';

      await expect(
        ngrxGenerator(tree, {
          ...defaultOptions,
          module: modulePath,
        })
      ).rejects.toThrowError(`Module does not exist: ${modulePath}.`);
    });

    it('should add an empty root module when minimal and root are set to true', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        root: true,
        minimal: true,
      });

      expect(
        tree.read('/apps/myapp/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should not generate files when minimal and root are set to true', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        root: true,
        minimal: true,
      });

      expect(tree.exists('/apps/myapp/src/app/+state/users.actions.ts')).toBe(
        false
      );
      expect(tree.exists('/apps/myapp/src/app/+state/users.effects.ts')).toBe(
        false
      );
      expect(
        tree.exists('/apps/myapp/src/app/+state/users.effects.spec.ts')
      ).toBe(false);
      expect(tree.exists('/apps/myapp/src/app/+state/users.reducer.ts')).toBe(
        false
      );
      expect(tree.exists('/apps/myapp/src/app/+state/users.selectors.ts')).toBe(
        false
      );
      expect(
        tree.exists('/apps/myapp/src/app/+state/users.selectors.spec.ts')
      ).toBe(false);
    });

    it('should add a root module with feature module when minimal is set to false', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        root: true,
        minimal: false,
      });

      expect(
        tree.read('/apps/myapp/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add a root module with feature module when minimal is set to false using --module', async () => {
      await ngrxGenerator(tree, {
        ...defaultModuleOptions,
        root: true,
        minimal: false,
      });

      expect(
        tree.read('/apps/myapp/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should not add RouterStoreModule when the module does not reference the router', async () => {
      createApp(tree, 'no-router-app', false);

      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: 'apps/no-router-app/src/app/app.module.ts',
        root: true,
      });

      const appModule = tree.read(
        '/apps/no-router-app/src/app/app.module.ts',
        'utf-8'
      );
      expect(appModule).not.toContain('StoreRouterConnectingModule.forRoot()');
    });

    it('should add facade provider when facade is true', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        root: true,
        minimal: false,
        facade: true,
      });

      expect(tree.read('/apps/myapp/src/app/app.module.ts', 'utf-8')).toContain(
        'providers: [UsersFacade]'
      );
    });

    it('should not add facade provider when facade is false', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        root: true,
        minimal: false,
        facade: false,
      });

      expect(
        tree.read('/apps/myapp/src/app/app.module.ts', 'utf-8')
      ).not.toContain('providers: [UsersFacade]');
    });

    it('should not add facade provider when minimal is true', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        root: true,
        minimal: true,
        facade: true,
      });

      expect(
        tree.read('/apps/myapp/src/app/app.module.ts', 'utf-8')
      ).not.toContain('providers: [UsersFacade]');
    });

    it('should not generate imports when skipImport is true', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        minimal: false,
        skipImport: true,
      });

      expectFileToExist('/apps/myapp/src/app/+state/users.actions.ts');
      expectFileToExist('/apps/myapp/src/app/+state/users.effects.ts');
      expectFileToExist('/apps/myapp/src/app/+state/users.effects.spec.ts');
      expectFileToExist('/apps/myapp/src/app/+state/users.reducer.ts');
      expectFileToExist('/apps/myapp/src/app/+state/users.selectors.ts');
      expectFileToExist('/apps/myapp/src/app/+state/users.selectors.spec.ts');
      expect(
        tree.read('/apps/myapp/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should update package.json', async () => {
      await ngrxGenerator(tree, defaultOptions);

      const packageJson = devkit.readJson(tree, 'package.json');
      expect(packageJson.dependencies['@ngrx/store']).toEqual(ngrxVersion);
      expect(packageJson.dependencies['@ngrx/effects']).toEqual(ngrxVersion);
      expect(packageJson.dependencies['@ngrx/entity']).toEqual(ngrxVersion);
      expect(packageJson.dependencies['@ngrx/router-store']).toEqual(
        ngrxVersion
      );
      expect(packageJson.dependencies['@ngrx/component-store']).toEqual(
        ngrxVersion
      );
      expect(packageJson.devDependencies['@ngrx/schematics']).toEqual(
        ngrxVersion
      );
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toEqual(
        ngrxVersion
      );
      expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
    });

    it('should not update package.json when skipPackageJson is true', async () => {
      await ngrxGenerator(tree, { ...defaultOptions, skipPackageJson: true });

      const packageJson = devkit.readJson(tree, 'package.json');
      expect(packageJson.dependencies['@ngrx/store']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/entity']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/component-store']).toBeUndefined();
      expect(packageJson.devDependencies['@ngrx/schematics']).toBeUndefined();
      expect(
        packageJson.devDependencies['@ngrx/store-devtools']
      ).toBeUndefined();
    });

    it('should generate files without a facade', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expectFileToExist(`${statePath}/users.actions.ts`);
      expectFileToExist(`${statePath}/users.effects.ts`);
      expectFileToExist(`${statePath}/users.effects.spec.ts`);
      expectFileToExist(`${statePath}/users.models.ts`);
      expectFileToExist(`${statePath}/users.reducer.ts`);
      expectFileToExist(`${statePath}/users.reducer.spec.ts`);
      expectFileToExist(`${statePath}/users.selectors.ts`);
      expectFileToExist(`${statePath}/users.selectors.spec.ts`);
      expectFileToNotExist(`${statePath}/users.facade.ts`);
      expectFileToNotExist(`${statePath}/users.facade.spec.ts`);
    });

    it('should generate files with a facade', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
        facade: true,
      });

      expectFileToExist(`${statePath}/users.actions.ts`);
      expectFileToExist(`${statePath}/users.effects.ts`);
      expectFileToExist(`${statePath}/users.effects.spec.ts`);
      expectFileToExist(`${statePath}/users.facade.ts`);
      expectFileToExist(`${statePath}/users.facade.spec.ts`);
      expectFileToExist(`${statePath}/users.models.ts`);
      expectFileToExist(`${statePath}/users.reducer.ts`);
      expectFileToExist(`${statePath}/users.reducer.spec.ts`);
      expectFileToExist(`${statePath}/users.selectors.ts`);
      expectFileToExist(`${statePath}/users.selectors.spec.ts`);
    });

    it('should generate the ngrx actions', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expect(
        tree.read(`${statePath}/users.actions.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx effects', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expect(
        tree.read(`${statePath}/users.effects.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx facade', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
        facade: true,
      });

      expect(
        tree.read(`${statePath}/users.facade.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a models file for the feature', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
        minimal: false,
      });

      expect(
        tree.read(`${statePath}/users.models.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx reducer', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expect(
        tree.read(`${statePath}/users.reducer.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx selectors', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expect(
        tree.read(`${statePath}/users.selectors.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate with custom directory', async () => {
      statePath = '/apps/myapp/src/app/my-custom-directory';

      await ngrxGenerator(tree, {
        ...defaultOptions,
        directory: 'my-custom-directory',
        minimal: false,
        facade: true,
      });

      expectFileToExist(`${statePath}/users.actions.ts`);
      expectFileToExist(`${statePath}/users.effects.ts`);
      expectFileToExist(`${statePath}/users.effects.spec.ts`);
      expectFileToExist(`${statePath}/users.facade.ts`);
      expectFileToExist(`${statePath}/users.facade.spec.ts`);
      expectFileToExist(`${statePath}/users.models.ts`);
      expectFileToExist(`${statePath}/users.reducer.ts`);
      expectFileToExist(`${statePath}/users.reducer.spec.ts`);
      expectFileToExist(`${statePath}/users.selectors.ts`);
      expectFileToExist(`${statePath}/users.selectors.spec.ts`);
    });

    it('should update the entry point file with the right exports', async () => {
      createLib(tree, 'flights');
      let libConfig = getLibConfig();

      await ngrxGenerator(tree, {
        ...defaultOptions,
        name: 'super-users',
        module: libConfig.module,
        facade: true,
      });

      expect(tree.read(libConfig.barrel, 'utf-8')).toMatchSnapshot();
    });

    it('should update the entry point file correctly when barrels is true', async () => {
      createLib(tree, 'flights');
      let libConfig = getLibConfig();

      await ngrxGenerator(tree, {
        ...defaultOptions,
        name: 'super-users',
        module: libConfig.module,
        facade: true,
        barrels: true,
      });

      expect(tree.read(libConfig.barrel, 'utf-8')).toMatchSnapshot();
    });

    it('should update the entry point file with no facade', async () => {
      createLib(tree, 'flights');
      let libConfig = getLibConfig();

      await ngrxGenerator(tree, {
        ...defaultOptions,
        name: 'super-users',
        module: libConfig.module,
        facade: false,
      });

      expect(tree.read(libConfig.barrel, 'utf-8')).toMatchSnapshot();
    });

    it('should format files', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await ngrxGenerator(tree, defaultOptions);

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when skipFormat is true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await ngrxGenerator(tree, { ...defaultOptions, skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });

    describe('generated unit tests', () => {
      it('should generate specs for the ngrx effects', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
        });

        expect(
          tree.read(`${statePath}/super-users.effects.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate specs for the ngrx facade', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
          facade: true,
        });

        expect(
          tree.read(`${statePath}/super-users.facade.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate specs for the ngrx reducer', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
        });

        expect(
          tree.read(`${statePath}/super-users.reducer.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate specs for the ngrx selectors', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
        });

        expect(
          tree.read(`${statePath}/super-users.selectors.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });
    });
  });

  describe('Standalone APIs', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, {
        name: 'my-app',
        standalone: true,
        routing: true,
      });
      tree.write(
        'apps/my-app/src/app/app.component.html',
        '<router-outlet></router-outlet>'
      );
      tree.write(
        'apps/my-app/src/app/app.routes.ts',
        `import { Routes } from '@angular/router';
        import { NxWelcomeComponent } from './nx-welcome.component'; 
      export const appRoutes: Routes = [{ path: '', component: NxWelcomeComponent }];`
      );
    });

    it('should throw when the parent cannot be found', async () => {
      // ARRANGE
      const parentPath = 'apps/my-app/src/app/non-existent.routes.ts';

      // ACT & ASSERT
      await expect(
        ngrxGenerator(tree, {
          ...defaultStandaloneOptions,
          parent: parentPath,
        })
      ).rejects.toThrowError(`Parent does not exist: ${parentPath}.`);
    });

    it('should add an empty provideStore when minimal and root are set to true', async () => {
      await ngrxGenerator(tree, {
        ...defaultStandaloneOptions,
        root: true,
        minimal: true,
      });

      expect(tree.read('/apps/my-app/src/main.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('/apps/my-app/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('/apps/my-app/src/app/+state/users.actions.ts')).toBe(
        false
      );
      expect(tree.exists('/apps/my-app/src/app/+state/users.effects.ts')).toBe(
        false
      );
      expect(
        tree.exists('/apps/my-app/src/app/+state/users.effects.spec.ts')
      ).toBe(false);
      expect(tree.exists('/apps/my-app/src/app/+state/users.reducer.ts')).toBe(
        false
      );
      expect(
        tree.exists('/apps/my-app/src/app/+state/users.selectors.ts')
      ).toBe(false);
      expect(
        tree.exists('/apps/my-app/src/app/+state/users.selectors.spec.ts')
      ).toBe(false);
    });

    it('should add a root module with feature module when minimal is set to false', async () => {
      await ngrxGenerator(tree, {
        ...defaultStandaloneOptions,
        root: true,
        minimal: false,
      });

      expect(tree.read('/apps/my-app/src/main.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('/apps/my-app/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add a feature module when route is undefined', async () => {
      await ngrxGenerator(tree, {
        ...defaultStandaloneOptions,
        root: false,
        route: undefined,
        parent: 'apps/my-app/src/app/app.routes.ts',
      });

      expect(
        tree.read('/apps/my-app/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add a feature module when route is non-empty', async () => {
      tree.write(
        'apps/my-app/src/app/app.routes.ts',
        `import { Routes } from '@angular/router';
        import { NxWelcomeComponent } from './nx-welcome.component'; 
      export const appRoutes: Routes = [{ path: 'home', component: NxWelcomeComponent }];`
      );

      await ngrxGenerator(tree, {
        ...defaultStandaloneOptions,
        root: false,
        route: 'home',
        parent: 'apps/my-app/src/app/app.routes.ts',
      });

      expect(
        tree.read('/apps/my-app/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add a feature module when route is set to default', async () => {
      await ngrxGenerator(tree, {
        ...defaultStandaloneOptions,
        root: false,
        route: '',
        parent: 'apps/my-app/src/app/app.routes.ts',
      });

      expect(
        tree.read('/apps/my-app/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add facade provider when facade is true', async () => {
      await ngrxGenerator(tree, {
        ...defaultStandaloneOptions,
        root: true,
        minimal: false,
        facade: true,
      });

      expect(tree.read('/apps/my-app/src/main.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('/apps/my-app/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add facade provider when facade is true and --root is false', async () => {
      await ngrxGenerator(tree, {
        ...defaultStandaloneOptions,
        root: false,
        minimal: false,
        facade: true,
        parent: 'apps/my-app/src/app/app.routes.ts',
      });

      expect(
        tree.read('/apps/my-app/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('angular v14 support', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, { name: 'myapp' });
      devkit.updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '14.0.0',
        },
      }));
    });

    it('should install the ngrx 14 packages', async () => {
      await ngrxGenerator(tree, defaultOptions);

      const packageJson = devkit.readJson(tree, 'package.json');
      expect(packageJson.dependencies['@ngrx/store']).toEqual(
        backwardCompatibleVersions.angularV14.ngrxVersion
      );
      expect(packageJson.dependencies['@ngrx/effects']).toEqual(
        backwardCompatibleVersions.angularV14.ngrxVersion
      );
      expect(packageJson.dependencies['@ngrx/entity']).toEqual(
        backwardCompatibleVersions.angularV14.ngrxVersion
      );
      expect(packageJson.dependencies['@ngrx/router-store']).toEqual(
        backwardCompatibleVersions.angularV14.ngrxVersion
      );
      expect(packageJson.dependencies['@ngrx/component-store']).toEqual(
        backwardCompatibleVersions.angularV14.ngrxVersion
      );
      expect(packageJson.devDependencies['@ngrx/schematics']).toEqual(
        backwardCompatibleVersions.angularV14.ngrxVersion
      );
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toEqual(
        backwardCompatibleVersions.angularV14.ngrxVersion
      );
      expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
    });

    it('should generate the ngrx effects with no usage of "inject"', async () => {
      await ngrxGenerator(tree, defaultOptions);

      expect(
        tree.read('apps/myapp/src/app/+state/users.effects.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx effects using "inject" for versions >= 14.1.0', async () => {
      devkit.updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '14.1.0',
        },
      }));

      await ngrxGenerator(tree, defaultOptions);

      expect(
        tree.read('apps/myapp/src/app/+state/users.effects.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx facade with no usage of "inject"', async () => {
      await ngrxGenerator(tree, { ...defaultOptions, facade: true });

      expect(
        tree.read('apps/myapp/src/app/+state/users.facade.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx facade using "inject" for versions >= 14.1.0', async () => {
      devkit.updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '14.1.0',
        },
      }));

      await ngrxGenerator(tree, { ...defaultOptions, facade: true });

      expect(
        tree.read('apps/myapp/src/app/+state/users.facade.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should throw when Angular version < 14.1 and NgRx < 15 but path to routes file is provided', async () => {
      const parentPath = 'apps/myapp/src/app/app.routes.ts';
      tree.write(
        parentPath,
        `import { Routes } from '@angular/router';
        import { NxWelcomeComponent } from './nx-welcome.component'; 
        export const appRoutes: Routes = [{ path: '', component: NxWelcomeComponent }];`
      );

      devkit.updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '14.1.0',
          '@ngrx/store': '14.1.0',
        },
      }));

      // ACT & ASSERT
      await expect(
        ngrxGenerator(tree, {
          ...defaultStandaloneOptions,
          parent: parentPath,
        })
      ).rejects.toThrowError(
        `The provided parent path "${parentPath}" does not contain an "NgModule".`
      );
    });

    it('should throw when Angular version < 15 and NgRx is not currently installed but path to routes file is provided', async () => {
      const parentPath = 'apps/myapp/src/app/app.routes.ts';
      tree.write(
        parentPath,
        `import { Routes } from '@angular/router';
        import { NxWelcomeComponent } from './nx-welcome.component'; 
        export const appRoutes: Routes = [{ path: '', component: NxWelcomeComponent }];`
      );

      devkit.updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '14.2.0',
        },
      }));

      // ACT & ASSERT
      await expect(
        ngrxGenerator(tree, {
          ...defaultStandaloneOptions,
          parent: parentPath,
        })
      ).rejects.toThrowError(
        `The provided parent path "${parentPath}" does not contain an "NgModule".`
      );
    });

    it('should throw when the provided parent does not have an NgModule', async () => {
      const parentPath = 'apps/myapp/src/app/app.routes.ts';
      tree.write(
        parentPath,
        `import { Routes } from '@angular/router';
        import { NxWelcomeComponent } from './nx-welcome.component'; 
        export const appRoutes: Routes = [{ path: '', component: NxWelcomeComponent }];`
      );

      // ACT & ASSERT
      await expect(
        ngrxGenerator(tree, {
          ...defaultStandaloneOptions,
          parent: parentPath,
        })
      ).rejects.toThrowError(
        `The provided parent path "${parentPath}" does not contain an "NgModule".`
      );
    });
  });

  describe('rxjs v6 support', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestApplication(tree, { name: 'myapp' });
      devkit.updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          rxjs: '~6.6.7',
        },
      }));
    });

    it('should generate the ngrx effects using rxjs operators imported from "rxjs/operators"', async () => {
      await ngrxGenerator(tree, defaultOptions);

      expect(
        tree.read('/apps/myapp/src/app/+state/users.effects.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});
