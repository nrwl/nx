import {
  SchematicTestRunner,
  UnitTestTree
} from '@angular-devkit/schematics/testing';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { getFileContent } from '@schematics/angular/utility/test';
import { readJsonInTree } from '../../utils/ast-utils';

import * as path from 'path';
import { findModuleParent } from '../../utils/name-utils';
import {
  createApp,
  createLib,
  createEmptyWorkspace,
  AppConfig,
  getLibConfig,
  getAppConfig
} from '../../utils/testing-utils';

describe('ngrx', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
    appTree = createApp(appTree, 'myapp');
  });

  it('should add empty root', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        onlyEmptyRoot: true
      },
      appTree
    );
    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');

    expect(
      tree.exists('apps/myapp/src/app/+state/state.actions.ts')
    ).toBeFalsy();

    expect(appModule).toContain(
      'StoreModule.forRoot({},{ metaReducers : !environment.production ? [storeFreeze] : [] })'
    );
    expect(appModule).toContain('EffectsModule.forRoot');
  });

  it('should add root', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'app',
        module: 'apps/myapp/src/app/app.module.ts',
        root: true
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');

    expect(appModule).toContain(`import { NxModule } from '@nrwl/nx';`);
    expect(appModule).toContain('NxModule.forRoot');
    expect(appModule).toContain('StoreModule.forRoot');
    expect(appModule).toContain('EffectsModule.forRoot');
    expect(appModule).toContain('!environment.production ? [storeFreeze] : []');

    expect(appModule).toContain('app: appReducer');
    expect(appModule).toContain('initialState : { app : appInitialState }');

    [
      '/apps/myapp/src/app/+state/app.actions.ts',
      '/apps/myapp/src/app/+state/app.effects.ts',
      '/apps/myapp/src/app/+state/app.effects.spec.ts',
      '/apps/myapp/src/app/+state/app.reducer.ts',
      '/apps/myapp/src/app/+state/app.reducer.spec.ts',
      '/apps/myapp/src/app/+state/app.selectors.ts'
    ].forEach(fileName => {
      expect(tree.exists(fileName)).toBeTruthy();
    });
  });

  it('should not add RouterStoreModule only if the module does not reference the router', () => {
    const newTree = createApp(appTree, 'myapp-norouter', false);
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'app',
        module: 'apps/myapp-norouter/src/app/app.module.ts',
        root: true
      },
      newTree
    );
    const appModule = getFileContent(
      tree,
      '/apps/myapp-norouter/src/app/app.module.ts'
    );
    expect(appModule).not.toContain('StoreRouterConnectingModule');
  });

  it('should add feature', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts'
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain('StoreModule.forFeature');
    expect(appModule).toContain('EffectsModule.forFeature');
    expect(appModule).toContain("'state', stateReducer");
    expect(appModule).toContain('{ initialState: stateInitialState }');
    expect(appModule).not.toContain(
      '!environment.production ? [storeFreeze] : []'
    );

    expect(
      tree.exists(`/apps/myapp/src/app/+state/state.actions.ts`)
    ).toBeTruthy();
  });

  it('should add with custom directoryName', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        directory: 'myCustomState'
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain('StoreModule.forFeature');
    expect(appModule).toContain('EffectsModule.forFeature');
    expect(appModule).not.toContain(
      '!environment.production ? [storeFreeze] : []'
    );

    expect(
      tree.exists(`/apps/myapp/src/app/my-custom-state/state.actions.ts`)
    ).toBeTruthy();
  });

  it('should only add files', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        onlyAddFiles: true
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).not.toContain('StoreModule');
    expect(appModule).not.toContain(
      '!environment.production ? [storeFreeze] : []'
    );

    [
      '/apps/myapp/src/app/+state/state.effects.ts',
      '/apps/myapp/src/app/+state/state.reducer.ts',
      '/apps/myapp/src/app/+state/state.selectors.ts'
    ].forEach(fileName => {
      expect(tree.exists(fileName)).toBeTruthy();
    });
  });

  it('should update package.json', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts'
      },
      appTree
    );
    const packageJson = readJsonInTree(tree, 'package.json');

    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();
    expect(packageJson.devDependencies['ngrx-store-freeze']).toBeDefined();
  });

  it('should error when no module is provided', () => {
    expect(() =>
      schematicRunner.runSchematic(
        'ngrx',
        {
          name: 'state'
        },
        appTree
      )
    ).toThrow('Specified module does not exist');
  });

  describe('code generation', () => {
    it('should scaffold the ngrx "user" files', () => {
      const appConfig = getAppConfig();
      const hasFile = file => expect(tree.exists(file)).toBeTruthy();
      const tree = buildNgrxTree(appConfig);
      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;

      hasFile(`${statePath}/user.actions.ts`);
      hasFile(`${statePath}/user.effects.ts`);
      hasFile(`${statePath}/user.effects.spec.ts`);
      hasFile(`${statePath}/user.reducer.ts`);
      hasFile(`${statePath}/user.reducer.spec.ts`);
      hasFile(`${statePath}/user.selectors.ts`);
    });

    it('should build the ngrx actions', () => {
      const appConfig = getAppConfig();
      const tree = buildNgrxTree(appConfig, 'users');

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.actions.ts`);

      expect(content).toContain('UsersActionTypes');

      expect(content).toContain('LoadUsers = "[Users] Load Users"');
      expect(content).toContain('UsersLoaded = "[Users] Users Loaded"');
      expect(content).toContain('UsersLoadError = "[Users] Users Load Error"');

      expect(content).toContain('class LoadUsers implements Action');
      expect(content).toContain('class UsersLoaded implements Action');
      expect(content).toContain(
        'type UsersAction = LoadUsers | UsersLoaded | UsersLoadError'
      );
      expect(content).toContain('export const fromUsersActions');
    });

    it('should build the ngrx selectors', () => {
      const appConfig = getAppConfig();
      const tree = buildNgrxTree(appConfig, 'users');

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.selectors.ts`);

      [
        `import { UsersState } from './users.reducer'`,
        `export const usersQuery`
      ].forEach(text => {
        expect(content).toContain(text);
      });
    });

    it('should build the ngrx reducer', () => {
      const appConfig = getAppConfig();
      const tree = buildNgrxTree(appConfig, 'user');

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/user.reducer.ts`);

      expect(content).not.toContain('function reducer');

      [
        `import { UserAction, UserActionTypes } from \'./user.actions\'`,
        `export interface User`,
        `export interface UserState`,
        'export function userReducer',
        'state: UserState = initialState',
        'action: UserAction): UserState',
        'case UserActionTypes.UserLoaded'
      ].forEach(text => {
        expect(content).toContain(text);
      });
    });

    it('should build the ngrx effects', () => {
      const appConfig = getAppConfig();
      const tree = buildNgrxTree(appConfig, 'users');
      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.effects.ts`);

      [
        `import { DataPersistence } from \'@nrwl/nx\'`,
        `import { LoadUsers, UsersLoaded, UsersLoadError, UsersActionTypes } from \'./users.actions\'`,
        `loadUsers$`,
        `run: (action: LoadUsers, state: UsersState)`,
        `return new UsersLoaded([])`,
        `return new UsersLoadError(error)`,
        'private actions$: Actions',
        'private dataPersistence: DataPersistence<UsersState>)'
      ].forEach(text => {
        expect(content).toContain(text);
      });
    });
  });

  describe('spec test', () => {
    it('should produce proper specs for the ngrx reducer', () => {
      const appConfig = getAppConfig();
      const tree = buildNgrxTree(appConfig);

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const contents = tree.readContent(`${statePath}/user.reducer.spec.ts`);

      expect(contents).toContain(`describe('User Reducer', () => {`);
      expect(contents).toContain(
        'const result = userReducer(initialState, action);'
      );
    });

    it('should update the barrel API with exports for ngrx selector, and reducer', () => {
      appTree = createLib(appTree, 'flights');
      let libConfig = getLibConfig();
      let tree = schematicRunner.runSchematic(
        'ngrx',
        {
          name: 'super-users',
          module: libConfig.module
        },
        appTree
      );

      const barrel = tree.readContent(libConfig.barrel);
      expect(barrel).toContain(
        `export * from './lib/+state/super-users.selectors';`
      );
      expect(barrel).toContain(
        `export * from './lib/+state/super-users.reducer';`
      );
    });

    it('should produce proper specs for the ngrx reducer for a name with a dash', () => {
      const appConfig = getAppConfig();
      const tree = schematicRunner.runSchematic(
        'ngrx',
        {
          name: 'super-users',
          module: appConfig.appModule
        },
        appTree
      );

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const contents = tree.readContent(
        `${statePath}/super-users.reducer.spec.ts`
      );

      expect(contents).toContain(`describe('SuperUsers Reducer', () => {`);
      expect(contents).toContain(
        `const result = superUsersReducer(initialState, action);`
      );
    });
  });

  function buildNgrxTree(
    appConfig: AppConfig,
    featureName: string = 'user'
  ): UnitTestTree {
    return schematicRunner.runSchematic(
      'ngrx',
      {
        name: featureName,
        module: appConfig.appModule
      },
      appTree
    );
  }
});
