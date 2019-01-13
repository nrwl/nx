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
  getAppConfig,
  runSchematic
} from '../../utils/testing-utils';

describe('ngrx', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
    appTree = createApp(appTree, 'myapp');
  });

  it('should add empty root', async () => {
    const tree = await runSchematic(
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

    expect(appModule).toContain('StoreModule.forRoot(');
    expect(appModule).toContain(
      '{ metaReducers : !environment.production ? [storeFreeze] : [] }'
    );
    expect(appModule).toContain('EffectsModule.forRoot');
  });

  it('should add root', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'app',
        module: 'apps/myapp/src/app/app.module.ts',
        root: true
      },
      appTree
    );

    [
      '/apps/myapp/src/app/+state/app.actions.ts',
      '/apps/myapp/src/app/+state/app.effects.ts',
      '/apps/myapp/src/app/+state/app.effects.spec.ts',
      '/apps/myapp/src/app/+state/app.reducer.ts',
      '/apps/myapp/src/app/+state/app.reducer.spec.ts',
      '/apps/myapp/src/app/+state/app.selectors.ts',
      '/apps/myapp/src/app/+state/app.selectors.spec.ts'
    ].forEach(fileName => {
      expect(tree.exists(fileName)).toBeTruthy();
    });

    // Since we did not include the `--facade` option
    expect(tree.exists('/apps/myapp/src/app/+state/app.facade.ts')).toBeFalsy();
    expect(
      tree.exists('/apps/myapp/src/app/+state/app.facade.spec.ts')
    ).toBeFalsy();

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');

    expect(appModule).toContain(`import { NxModule } from '@nrwl/nx';`);
    expect(appModule).toContain('NxModule.forRoot');
    expect(appModule).toContain('StoreModule.forRoot');
    expect(appModule).toContain('EffectsModule.forRoot');
    expect(appModule).toContain('!environment.production ? [storeFreeze] : []');

    expect(appModule).toContain('app: appReducer');
    expect(appModule).toContain('initialState : { app : appInitialState }');
  });

  it('should add facade to root', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'app',
        module: 'apps/myapp/src/app/app.module.ts',
        root: true,
        facade: true
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');

    expect(appModule).toContain(`import { NxModule } from '@nrwl/nx';`);
    expect(appModule).toContain('NxModule.forRoot');
    expect(appModule).toContain('StoreModule.forRoot');
    expect(appModule).toContain('EffectsModule.forRoot');
    expect(appModule).toContain('!environment.production ? [storeFreeze] : []');

    // Do not add Effects file to providers; already registered in EffectsModule
    expect(appModule).toContain('providers: [AppFacade]');

    expect(appModule).toContain('app: appReducer');
    expect(appModule).toContain('initialState : { app : appInitialState }');

    [
      '/apps/myapp/src/app/+state/app.actions.ts',
      '/apps/myapp/src/app/+state/app.effects.ts',
      '/apps/myapp/src/app/+state/app.effects.spec.ts',
      '/apps/myapp/src/app/+state/app.reducer.ts',
      '/apps/myapp/src/app/+state/app.reducer.spec.ts',
      '/apps/myapp/src/app/+state/app.facade.ts',
      '/apps/myapp/src/app/+state/app.facade.spec.ts',
      '/apps/myapp/src/app/+state/app.selectors.ts',
      '/apps/myapp/src/app/+state/app.selectors.spec.ts'
    ].forEach(fileName => {
      expect(tree.exists(fileName)).toBeTruthy();
    });
  });

  it('should not add RouterStoreModule only if the module does not reference the router', async () => {
    const newTree = createApp(appTree, 'myapp-norouter', false);
    const tree = await runSchematic(
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

  it('should add feature', async () => {
    const tree = await runSchematic(
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
    expect(appModule).toContain('STATE_FEATURE_KEY, stateReducer');
    expect(appModule).toContain('initialState: stateInitialState');
    expect(appModule).not.toContain(
      '!environment.production ? [storeFreeze] : []'
    );

    expect(
      tree.exists(`/apps/myapp/src/app/+state/state.actions.ts`)
    ).toBeTruthy();
  });

  it('should add with custom directoryName', async () => {
    const tree = await runSchematic(
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

  it('should only add files', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        onlyAddFiles: true,
        facade: true
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
      '/apps/myapp/src/app/+state/state.facade.ts',
      '/apps/myapp/src/app/+state/state.reducer.ts',
      '/apps/myapp/src/app/+state/state.selectors.ts',
      '/apps/myapp/src/app/+state/state.effects.spec.ts',
      '/apps/myapp/src/app/+state/state.facade.spec.ts',
      '/apps/myapp/src/app/+state/state.selectors.spec.ts'
    ].forEach(fileName => {
      expect(tree.exists(fileName)).toBeTruthy();
    });
  });

  it('should update package.json', async () => {
    const tree = await runSchematic(
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

  it('should error when no module is provided', async () => {
    try {
      await runSchematic(
        'ngrx',
        {
          name: 'state',
          module: ''
        },
        appTree
      );
      fail();
    } catch (e) {
      expect(e.message).toEqual('The required --module option must be passed');
    }
  });

  it('should error the module could not be found', async () => {
    try {
      await runSchematic(
        'ngrx',
        {
          name: 'state',
          module: 'does-not-exist.ts'
        },
        appTree
      );
    } catch (e) {
      expect(e.message).toEqual('Path does not exist: does-not-exist.ts');
    }
  });

  describe('code generation', () => {
    it('should scaffold the ngrx "user" files without a facade', async () => {
      const appConfig = getAppConfig();
      const hasFile = file => expect(tree.exists(file)).toBeTruthy();
      const missingFile = file => expect(tree.exists(file)).not.toBeTruthy();
      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;

      const tree = await buildNgrxTree(appConfig);

      hasFile(`${statePath}/user.actions.ts`);
      hasFile(`${statePath}/user.effects.ts`);
      hasFile(`${statePath}/user.effects.spec.ts`);
      missingFile(`${statePath}/user.facade.ts`);
      missingFile(`${statePath}/user.facade.spec.ts`);
      hasFile(`${statePath}/user.reducer.ts`);
      hasFile(`${statePath}/user.reducer.spec.ts`);
      hasFile(`${statePath}/user.selectors.ts`);
    });

    it('should scaffold the ngrx "user" files WITH a facade', async () => {
      const appConfig = getAppConfig();
      const hasFile = file => expect(tree.exists(file)).toBeTruthy();
      const tree = await buildNgrxTree(appConfig, 'user', true);
      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;

      hasFile(`${statePath}/user.actions.ts`);
      hasFile(`${statePath}/user.effects.ts`);
      hasFile(`${statePath}/user.facade.ts`);
      hasFile(`${statePath}/user.reducer.ts`);
      hasFile(`${statePath}/user.selectors.ts`);

      hasFile(`${statePath}/user.reducer.spec.ts`);
      hasFile(`${statePath}/user.effects.spec.ts`);
      hasFile(`${statePath}/user.selectors.spec.ts`);
      hasFile(`${statePath}/user.facade.spec.ts`);
    });

    it('should build the ngrx actions', async () => {
      const appConfig = getAppConfig();
      const tree = await buildNgrxTree(appConfig, 'users');

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.actions.ts`);

      expect(content).toContain('UsersActionTypes');

      expect(content).toContain(`LoadUsers = "[Users] Load Users"`);
      expect(content).toContain(`UsersLoaded = "[Users] Users Loaded"`);
      expect(content).toContain(`UsersLoadError = "[Users] Users Load Error"`);

      expect(content).toContain('class LoadUsers implements Action');
      expect(content).toContain('class UsersLoaded implements Action');
      expect(content).toContain(
        'type UsersAction = LoadUsers | UsersLoaded | UsersLoadError'
      );
      expect(content).toContain('export const fromUsersActions');
    });

    it('should build the ngrx selectors', async () => {
      const appConfig = getAppConfig();
      const tree = await buildNgrxTree(appConfig, 'users');

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.selectors.ts`);

      [
        `import { USERS_FEATURE_KEY, UsersState } from './users.reducer'`,
        `export const usersQuery`
      ].forEach(text => {
        expect(content).toContain(text);
      });
    });

    it('should build the ngrx facade', async () => {
      const appConfig = getAppConfig();
      const includeFacade = true;
      const tree = await buildNgrxTree(appConfig, 'users', includeFacade);

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.facade.ts`);

      [
        `import { UsersPartialState } from './users.reducer'`,
        `import { usersQuery } from './users.selectors'`,
        `export class UsersFacade`
      ].forEach(text => {
        expect(content).toContain(text);
      });
    });

    it('should build the ngrx reducer', async () => {
      const appConfig = getAppConfig();
      const tree = await buildNgrxTree(appConfig, 'user');

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/user.reducer.ts`);

      expect(content).not.toContain('function reducer');

      [
        `import { UserAction, UserActionTypes } from \'./user.actions\'`,
        `export interface User`,
        `export interface UserState`,
        'export function userReducer',
        'state: UserState = initialState',
        'action: UserAction',
        '): UserState',
        'case UserActionTypes.UserLoaded'
      ].forEach(text => {
        expect(content).toContain(text);
      });
    });

    it('should build the ngrx effects', async () => {
      const appConfig = getAppConfig();
      const tree = await buildNgrxTree(appConfig, 'users');
      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.effects.ts`);

      [
        `import { DataPersistence } from \'@nrwl/nx\'`,
        `import { LoadUsers, UsersLoaded, UsersLoadError, UsersActionTypes } from './users.actions';`,
        `loadUsers$`,
        `run: (action: LoadUsers, state: UsersPartialState)`,
        `return new UsersLoaded([])`,
        `return new UsersLoadError(error)`,
        'private actions$: Actions',
        'private dataPersistence: DataPersistence<UsersPartialState>'
      ].forEach(text => {
        expect(content).toContain(text);
      });
    });
  });

  describe('unit tests', () => {
    it('should produce proper specs for the ngrx reducer', async () => {
      const appConfig = getAppConfig();
      const tree = await buildNgrxTree(appConfig);

      const statePath = `${findModuleParent(appConfig.appModule)}/+state`;
      const contents = tree.readContent(`${statePath}/user.reducer.spec.ts`);

      expect(contents).toContain(`describe('User Reducer', () => {`);
      expect(contents).toContain(
        'const result = userReducer(initialState, action);'
      );
    });

    it('should update the barrel API with exports for ngrx facade, selector, and reducer', async () => {
      appTree = createLib(appTree, 'flights');
      let libConfig = getLibConfig();
      let tree = await runSchematic(
        'ngrx',
        {
          name: 'super-users',
          module: libConfig.module,
          facade: true
        },
        appTree
      );

      const barrel = tree.readContent(libConfig.barrel);
      expect(barrel).toContain(
        `export * from './lib/+state/super-users.facade';`
      );
    });

    it('should not update the barrel API with a facade', async () => {
      appTree = createLib(appTree, 'flights');
      let libConfig = getLibConfig();
      let tree = await runSchematic(
        'ngrx',
        {
          name: 'super-users',
          module: libConfig.module,
          facade: false
        },
        appTree
      );

      const barrel = tree.readContent(libConfig.barrel);
      expect(barrel).not.toContain(
        `export * from './lib/+state/super-users.facade';`
      );
    });

    it('should produce proper tests for the ngrx reducer for a name with a dash', async () => {
      const appConfig = getAppConfig();
      const tree = await runSchematic(
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

  async function buildNgrxTree(
    appConfig: AppConfig,
    featureName: string = 'user',
    withFacade = false
  ): Promise<UnitTestTree> {
    return await runSchematic(
      'ngrx',
      {
        name: featureName,
        module: appConfig.appModule,
        facade: withFacade
      },
      appTree
    );
  }
});
