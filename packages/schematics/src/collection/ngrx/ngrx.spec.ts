import {
  SchematicTestRunner,
  UnitTestTree
} from '@angular-devkit/schematics/testing';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { getFileContent } from '@schematics/angular/utility/test';
import { readJson } from '../../utils/ast-utils';

import * as path from 'path';
import { findModuleParent } from '../../utils/name-utils';
import {
  createApp,
  createEmptyWorkspace,
  AppConfig,
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

    expect(appModule).toContain('StoreModule.forRoot');
    expect(appModule).toContain('EffectsModule.forRoot');
    expect(appModule).toContain('!environment.production ? [storeFreeze] : []');

    expect(appModule).toContain('appReducer, initialState');
    expect(appModule).not.toContain('AppData');
    expect(appModule).not.toContain('AppState');

    [
      '/apps/myapp/src/app/+state/app.actions.ts',
      '/apps/myapp/src/app/+state/app.effects.ts',
      '/apps/myapp/src/app/+state/app.effects.spec.ts',
      '/apps/myapp/src/app/+state/app.reducer.ts',
      '/apps/myapp/src/app/+state/app.reducer.spec.ts'
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
    expect(appModule).toContain('initialState: stateInitialState');
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

    expect(
      tree.exists(`/apps/myapp/src/app/+state/state.actions.ts`)
    ).toBeTruthy();
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
    const packageJson = readJson(tree, 'package.json');

    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(packageJson.dependencies['ngrx-store-freeze']).toBeDefined();
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
    ).toThrow("should have required property 'module'");
  });

  it('should create the ngrx files', () => {
    const appConfig = getAppConfig();
    const hasFile = file => expect(tree.exists(file)).toBeTruthy();
    const tree = buildNgrxTree(appConfig);
    const statePath = `${findModuleParent(appConfig.appModule)}/+state`;

    hasFile(`${statePath}/user.actions.ts`);
    hasFile(`${statePath}/user.effects.ts`);
    hasFile(`${statePath}/user.effects.spec.ts`);
    hasFile(`${statePath}/user.reducer.ts`);
    hasFile(`${statePath}/user.reducer.spec.ts`);
  });

  it('should create ngrx action enums', () => {
    const appConfig = getAppConfig();
    const tree = buildNgrxTree(appConfig);

    const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
    const content = getFileContent(tree, `${statePath}/user.actions.ts`);

    expect(content).toContain('UserActionTypes');
    expect(content).toContain("LoadUser = '[User] Load Data'");
    expect(content).toContain("UserLoaded = '[User] Data Loaded'");
  });

  it('should create ngrx action classes', () => {
    const appConfig = getAppConfig();
    const tree = buildNgrxTree(appConfig);

    const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
    const content = getFileContent(tree, `${statePath}/user.actions.ts`);

    expect(content).toContain('class LoadUser implements Action');
    expect(content).toContain('class UserLoaded implements Action');
  });

  it('should enhance the ngrx action type', () => {
    const appConfig = getAppConfig();
    const tree = buildNgrxTree(appConfig);

    const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
    const content = getFileContent(tree, `${statePath}/user.actions.ts`);
    expect(content).toContain(
      'type UserActions = User | LoadUser | UserLoaded'
    );
  });

  it('should enhance the ngrx reducer', () => {
    const appConfig = getAppConfig();
    const tree = buildNgrxTree(appConfig);

    const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
    const content = getFileContent(tree, `${statePath}/user.reducer.ts`);

    expect(content).not.toContain('function reducer');

    [
      `import { UserActions, UserActionTypes } from \'./user.actions\'`,
      `export interface UserData`,
      `export interface UserState`,
      `readonly user: UserData`,
      `const initialState: UserData`,
      'function userReducer(state = initialState, action: UserActions): UserData',
      'case UserActionTypes.UserLoaded'
    ].forEach(text => {
      expect(content).toContain(text);
    });
  });

  it('should enhance the ngrx effects', () => {
    const appConfig = getAppConfig();
    const tree = buildNgrxTree(appConfig);
    const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
    const content = getFileContent(tree, `${statePath}/user.effects.ts`);

    [
      `import { DataPersistence } from \'@nrwl/nx\'`,
      `import { UserActions, UserActionTypes, LoadUser, UserLoaded } from \'./user.actions\'`,
      `loadUser$`,
      `run: (action: LoadUser, state: UserState)`,
      `return new UserLoaded(state)`,
      'constructor(private actions$: Actions, private dataPersistence: DataPersistence<UserState>)'
    ].forEach(text => {
      expect(content).toContain(text);
    });
  });

  function buildNgrxTree(appConfig: AppConfig): UnitTestTree {
    return schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'user',
        module: appConfig.appModule
      },
      appTree
    );
  }
});
