import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';

import { getFileContent } from '@nrwl/workspace/testing';
import {
  AppConfig,
  createApp,
  createLib,
  getAppConfig,
  getLibConfig,
  runSchematic,
} from '../../utils/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';

describe('ngrx', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = createApp(appTree, 'myapp');
  });

  it('should add empty root', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        onlyEmptyRoot: true,
        minimal: false,
        root: true,
      },
      appTree
    );
    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');

    expect(
      tree.exists('apps/myapp/src/app/+state/state.actions.ts')
    ).toBeFalsy();

    expect(appModule).toContain('StoreModule.forRoot(');
    expect(appModule).toContain('runtimeChecks: {');
    expect(appModule).toContain('strictActionImmutability: true');
    expect(appModule).toContain('strictStateImmutability: true');
    expect(appModule).toContain('EffectsModule.forRoot');
  });

  it('should add empty root with minimal option', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        root: true,
        onlyEmptyRoot: false,
        minimal: true,
      },
      appTree
    );
    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');

    expect(
      tree.exists('apps/myapp/src/app/+state/state.actions.ts')
    ).toBeFalsy();

    expect(appModule).toContain('StoreModule.forRoot(');
    expect(appModule).toContain('runtimeChecks: {');
    expect(appModule).toContain('strictActionImmutability: true');
    expect(appModule).toContain('strictStateImmutability: true');
    expect(appModule).toContain('EffectsModule.forRoot([])');
  });

  it('should add root', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'app',
        module: 'apps/myapp/src/app/app.module.ts',
        root: true,
        minimal: false,
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
      '/apps/myapp/src/app/+state/app.selectors.spec.ts',
    ].forEach((fileName) => {
      expect(tree.exists(fileName)).toBeTruthy();
    });

    // Since we did not include the `--facade` option
    expect(tree.exists('/apps/myapp/src/app/+state/app.facade.ts')).toBeFalsy();
    expect(
      tree.exists('/apps/myapp/src/app/+state/app.facade.spec.ts')
    ).toBeFalsy();

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');

    expect(appModule).toContain(`import { NxModule } from '@nrwl/angular';`);
    expect(appModule).toContain(
      `import * as fromApp from './+state/app.reducer';`
    );
    expect(appModule).toContain('NxModule.forRoot');
    expect(appModule).toContain('StoreModule.forRoot');
    expect(appModule).toContain(
      `StoreModule.forFeature(fromApp.APP_FEATURE_KEY, fromApp.reducer)`
    );
    expect(appModule).toContain('EffectsModule.forRoot');
    expect(appModule).toContain(
      'metaReducers: !environment.production ? [] : []'
    );
  });

  it('should add facade to root', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'app',
        module: 'apps/myapp/src/app/app.module.ts',
        root: true,
        facade: true,
        minimal: false,
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');

    expect(appModule).toContain(`import { NxModule } from '@nrwl/angular';`);
    expect(appModule).toContain('NxModule.forRoot');
    expect(appModule).toContain('StoreModule.forRoot');
    expect(appModule).toContain('EffectsModule.forRoot');
    expect(appModule).toContain(
      'metaReducers: !environment.production ? [] : []'
    );

    // Do not add Effects file to providers; already registered in EffectsModule
    expect(appModule).toContain('providers: [AppFacade]');

    [
      '/apps/myapp/src/app/+state/app.actions.ts',
      '/apps/myapp/src/app/+state/app.effects.ts',
      '/apps/myapp/src/app/+state/app.effects.spec.ts',
      '/apps/myapp/src/app/+state/app.reducer.ts',
      '/apps/myapp/src/app/+state/app.reducer.spec.ts',
      '/apps/myapp/src/app/+state/app.facade.ts',
      '/apps/myapp/src/app/+state/app.facade.spec.ts',
      '/apps/myapp/src/app/+state/app.selectors.ts',
      '/apps/myapp/src/app/+state/app.selectors.spec.ts',
    ].forEach((fileName) => {
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
        root: true,
      },
      newTree
    );
    const appModule = getFileContent(
      tree,
      '/apps/myapp-norouter/src/app/app.module.ts'
    );
    expect(appModule).not.toContain('StoreRouterConnectingModule.forRoot()');
  });

  it('should add feature', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        minimal: false,
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain('StoreModule.forFeature');
    expect(appModule).toContain('EffectsModule.forFeature');
    expect(appModule).not.toContain('!environment.production ? [] : []');

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
        directory: 'myCustomState',
        minimal: false,
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain('StoreModule.forFeature');
    expect(appModule).toContain('EffectsModule.forFeature');
    expect(appModule).not.toContain('!environment.production ? [] : []');

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
        facade: true,
        minimal: false,
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).not.toContain('StoreModule');
    expect(appModule).not.toContain('!environment.production ? [] : []');

    [
      '/apps/myapp/src/app/+state/state.effects.ts',
      '/apps/myapp/src/app/+state/state.facade.ts',
      '/apps/myapp/src/app/+state/state.reducer.ts',
      '/apps/myapp/src/app/+state/state.selectors.ts',
      '/apps/myapp/src/app/+state/state.effects.spec.ts',
      '/apps/myapp/src/app/+state/state.facade.spec.ts',
      '/apps/myapp/src/app/+state/state.selectors.spec.ts',
    ].forEach((fileName) => {
      expect(tree.exists(fileName)).toBeTruthy();
    });
  });

  it('should only add files with skipImport option', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        onlyAddFiles: false,
        skipImport: true,
        facade: true,
        minimal: false,
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).not.toContain('StoreModule');
    expect(appModule).not.toContain('!environment.production ? [] : []');

    [
      '/apps/myapp/src/app/+state/state.effects.ts',
      '/apps/myapp/src/app/+state/state.facade.ts',
      '/apps/myapp/src/app/+state/state.reducer.ts',
      '/apps/myapp/src/app/+state/state.selectors.ts',
      '/apps/myapp/src/app/+state/state.effects.spec.ts',
      '/apps/myapp/src/app/+state/state.facade.spec.ts',
      '/apps/myapp/src/app/+state/state.selectors.spec.ts',
    ].forEach((fileName) => {
      expect(tree.exists(fileName)).toBeTruthy();
    });
  });

  it('should update package.json', async () => {
    const tree = await runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
      },
      appTree
    );
    const packageJson = readJsonInTree(tree, 'package.json');

    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();
  });

  it('should error when no module is provided', async () => {
    try {
      await runSchematic(
        'ngrx',
        {
          name: 'state',
          module: '',
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
          module: 'does-not-exist.ts',
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
      const hasFile = (file) => expect(tree.exists(file)).toBeTruthy();
      const missingFile = (file) => expect(tree.exists(file)).not.toBeTruthy();
      const statePath = `${path.dirname(appConfig.appModule)}/+state`;

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
      const hasFile = (file) => expect(tree.exists(file)).toBeTruthy();
      const tree = await buildNgrxTree(appConfig, 'user', true);
      const statePath = `${path.dirname(appConfig.appModule)}/+state`;

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

      const statePath = `${path.dirname(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.actions.ts`);

      expect(content).toContain('UsersActionTypes');

      expect(content).toContain(`LoadUsers = '[Users] Load Users'`);
      expect(content).toContain(`UsersLoaded = '[Users] Users Loaded'`);
      expect(content).toContain(`UsersLoadError = '[Users] Users Load Error'`);

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

      const statePath = `${path.dirname(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.selectors.ts`);

      [
        `import { USERS_FEATURE_KEY, UsersState } from './users.reducer'`,
        `export const usersQuery`,
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should build the ngrx facade', async () => {
      const appConfig = getAppConfig();
      const includeFacade = true;
      const tree = await buildNgrxTree(appConfig, 'users', includeFacade);

      const statePath = `${path.dirname(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.facade.ts`);

      [
        `import { UsersPartialState } from './users.reducer'`,
        `import { usersQuery } from './users.selectors'`,
        `export class UsersFacade`,
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should build the ngrx reducer', async () => {
      const appConfig = getAppConfig();
      const tree = await buildNgrxTree(appConfig, 'user');

      const statePath = `${path.dirname(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/user.reducer.ts`);

      [
        `import { UserAction, UserActionTypes } from \'./user.actions\'`,
        `export interface User`,
        `export interface UserState`,
        'export function reducer',
        'state: UserState = initialState',
        'action: UserAction',
        '): UserState',
        'case UserActionTypes.UserLoaded',
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should build the ngrx effects', async () => {
      const appConfig = getAppConfig();
      const tree = await buildNgrxTree(appConfig, 'users');
      const statePath = `${path.dirname(appConfig.appModule)}/+state`;
      const content = getFileContent(tree, `${statePath}/users.effects.ts`);

      [
        `import { DataPersistence } from '@nrwl/angular'`,
        `
import {
  LoadUsers,
  UsersLoaded,
  UsersLoadError,
  UsersActionTypes,
} from './users.actions';`,
        `loadUsers$`,
        `run: (action: LoadUsers, state: UsersPartialState)`,
        `return new UsersLoaded([])`,
        `return new UsersLoadError(error)`,
        'private actions$: Actions',
        'private dataPersistence: DataPersistence<UsersPartialState>',
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });
  });

  describe('unit tests', () => {
    it('should produce proper specs for the ngrx reducer', async () => {
      const appConfig = getAppConfig();
      const tree = await buildNgrxTree(appConfig);

      const statePath = `${path.dirname(appConfig.appModule)}/+state`;
      const contents = tree.readContent(`${statePath}/user.reducer.spec.ts`);

      expect(contents).toContain(`describe('User Reducer', () => {`);
      expect(contents).toContain(
        'const result = reducer(initialState, action);'
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
          facade: true,
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
          facade: false,
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
          module: appConfig.appModule,
          minimal: false,
        },
        appTree
      );

      const statePath = `${path.dirname(appConfig.appModule)}/+state`;
      const contents = tree.readContent(
        `${statePath}/super-users.reducer.spec.ts`
      );

      expect(contents).toContain(`describe('SuperUsers Reducer', () => {`);
      expect(contents).toContain(
        `const result = reducer(initialState, action);`
      );
    });
  });

  describe('creators syntax', () => {
    let appConfig = getAppConfig();
    let tree: UnitTestTree;
    let statePath: string;

    beforeEach(async () => {
      appConfig = getAppConfig();
      tree = await runSchematic(
        'ngrx',
        {
          name: 'users',
          module: appConfig.appModule,
          syntax: 'creators',
          minimal: false,
          facade: true,
          useDataPersistence: false,
        },
        appTree
      );

      statePath = `${path.dirname(appConfig.appModule)}/+state`;
    });

    it('should generate a set of actions for the feature', async () => {
      const content = tree.readContent(`${statePath}/users.actions.ts`);

      [
        '[Users Page] Init',
        '[Users/API] Load Users Success',
        'props<{ users: UsersEntity[] }>()',
        '[Users/API] Load Users Failure',
        'props<{ error: any }>()',
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should generate a reducer for the feature', async () => {
      const content = tree.readContent(`${statePath}/users.reducer.ts`);

      [
        `export const USERS_FEATURE_KEY = 'users';`,
        `const usersReducer = createReducer`,
        'export function reducer(state: State | undefined, action: Action) {',
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should generate effects for the feature', async () => {
      const content = tree.readContent(`${statePath}/users.effects.ts`);

      [
        `import { createEffect, Actions, ofType } from '@ngrx/effects';`,
        'fetch({',
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should generate selectors for the feature', async () => {
      const content = tree.readContent(`${statePath}/users.selectors.ts`);

      [
        `
import {
  USERS_FEATURE_KEY,
  State,
  UsersPartialState,
  usersAdapter,
} from './users.reducer';`,
        `const { selectAll, selectEntities } = usersAdapter.getSelectors();`,
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should generate a facade for the feature if enabled', async () => {
      const content = tree.readContent(`${statePath}/users.facade.ts`);

      [
        `loaded$ = this.store.pipe(select(UsersSelectors.getUsersLoaded));`,
        `allUsers$ = this.store.pipe(select(UsersSelectors.getAllUsers));`,
        `selectedUsers$ = this.store.pipe(select(UsersSelectors.getSelected));`,
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should generate a models file for the feature', async () => {
      const content = tree.readContent(`${statePath}/users.models.ts`);

      [
        'export interface UsersEntity',
        'id: string | number; // Primary ID',
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });

    it('should use DataPersistence operators when useDataPersistence is set to false', async () => {
      appTree = Tree.empty();
      appTree = createEmptyWorkspace(appTree);
      appTree = createApp(appTree, 'myapp');
      const tree = await runSchematic(
        'ngrx',
        {
          name: 'users',
          module: appConfig.appModule,
          syntax: 'creators',
          facade: true,
          minimal: false,
        },
        appTree
      );
      const content = tree.readContent(`${statePath}/users.effects.ts`);

      [`{ fetch }`, `, ofType`, `ofType(UsersActions.init),`].forEach(
        (text) => {
          expect(content).toContain(text);
        }
      );

      expect(content).not.toContain('dataPersistence.fetch');
    });

    it('should re-export actions, state, and selectors using barrels if enabled', async () => {
      appTree = Tree.empty();
      appTree = createEmptyWorkspace(appTree);
      appTree = createApp(appTree, 'myapp');
      appTree.create('/apps/myapp/src/index.ts', '');

      const tree = await runSchematic(
        'ngrx',
        {
          name: 'users',
          module: appConfig.appModule,
          syntax: 'creators',
          barrels: true,
        },
        appTree
      );

      const content = tree.readContent('/apps/myapp/src/index.ts');

      [
        `import * as UsersActions from './lib/+state/users.actions';`,
        `import * as UsersFeature from './lib/+state/users.reducer';`,
        `import * as UsersSelectors from './lib/+state/users.selectors';`,
        `export { UsersActions, UsersFeature, UsersSelectors };`,
        `export * from './lib/+state/users.models';`,
      ].forEach((text) => {
        expect(content).toContain(text);
      });
    });
  });

  describe('classes syntax', () => {
    it('should use fetch operator when useDataPersistence is set to false', async () => {
      const appConfig = getAppConfig();
      const tree = await runSchematic(
        'ngrx',
        {
          name: 'users',
          module: appConfig.appModule,
          syntax: 'classes',
          minimal: false,
          facade: true,
          useDataPersistence: false,
        },
        appTree
      );

      const statePath = `${path.dirname(appConfig.appModule)}/+state`;
      const content = tree.readContent(`${statePath}/users.effects.ts`);

      [`{ fetch }`, `, ofType`, `ofType(UsersActionTypes.LoadUsers),`].forEach(
        (text) => {
          expect(content).toContain(text);
        }
      );

      expect(content).not.toContain('dataPersistence.fetch');
    });
  });

  async function buildNgrxTree(
    appConfig: AppConfig,
    featureName: string = 'user',
    withFacade = false,
    useDataPersistence = true
  ): Promise<UnitTestTree> {
    return await runSchematic(
      'ngrx',
      {
        name: featureName,
        module: appConfig.appModule,
        facade: withFacade,
        syntax: 'classes',
        minimal: false,
        useDataPersistence,
      },
      appTree
    );
  }
});
