import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { createApp } from '../../utils/nx-devkit/testing';
import { ngrxVersion } from '../../utils/versions';
import { ngrxGenerator } from './ngrx';
import type { NgRxGeneratorOptions } from './schema';

describe('ngrx', () => {
  let tree: Tree;
  const defaultOptions: NgRxGeneratorOptions = {
    directory: '+state',
    minimal: true,
    module: 'apps/myapp/src/app/app.module.ts',
    name: 'users',
    useDataPersistence: false,
  };

  const expectFileToExist = (file: string) =>
    expect(tree.exists(file)).toBeTruthy();

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    createApp(tree, 'myapp');
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
    expect(packageJson.dependencies['@ngrx/router-store']).toEqual(ngrxVersion);
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
    expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeUndefined();
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
});
