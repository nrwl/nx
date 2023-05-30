import type { Tree } from '@nx/devkit';
import { readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ngrxVersion } from '../../utils/versions';
import { generateTestApplication } from '../utils/testing';
import { ngrxRootStoreGenerator } from './ngrx-root-store';

describe('NgRxRootStoreGenerator', () => {
  describe('NgModule', () => {
    it('should error when project does not exist', async () => {
      const tree = createTreeWithEmptyWorkspace();

      await expect(
        ngrxRootStoreGenerator(tree, {
          project: 'non-exist',
          minimal: true,
          name: '',
        })
      ).rejects.toThrowError();
    });

    it('should error when minimal false, but name is undefined or falsy', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createNgModuleApp(tree);

      // ACT & ASSERT
      await expect(
        ngrxRootStoreGenerator(tree, {
          project: 'my-app',
          minimal: false,
          name: undefined,
        })
      ).rejects.toThrowError();
    });

    it('should add an empty root module when --minimal=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createNgModuleApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
      });

      // ASSERT
      expect(
        tree.read('my-app/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('/my-app/src/app/+state/users.actions.ts')).toBe(
        false
      );
      expect(tree.exists('/my-app/src/app/+state/users.effects.ts')).toBe(
        false
      );
      expect(tree.exists('/my-app/src/app/+state/users.effects.spec.ts')).toBe(
        false
      );
      expect(tree.exists('/my-app/src/app/+state/users.reducer.ts')).toBe(
        false
      );
      expect(tree.exists('/my-app/src/app/+state/users.selectors.ts')).toBe(
        false
      );
      expect(
        tree.exists('/my-app/src/app/+state/users.selectors.spec.ts')
      ).toBe(false);
    });

    it('should add a root module and root state when --minimal=false', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createNgModuleApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: false,
        name: 'users',
      });

      // ASSERT
      expect(
        tree.read('my-app/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.actions.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.effects.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.effects.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.reducer.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.selectors.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.selectors.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add a facade when --facade=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createNgModuleApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: false,
        name: 'users',
        facade: true,
      });

      // ASSERT
      expect(
        tree.read('my-app/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.facade.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should instrument the store devtools when "addDevTools: true"', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createNgModuleApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
        addDevTools: true,
      });

      // ASSERT
      expect(
        tree.read('my-app/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should update package.json', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createNgModuleApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
      });

      // ASSERT
      const packageJson = readJson(tree, 'package.json');
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
      expect(
        packageJson.devDependencies['@ngrx/store-devtools']
      ).toBeUndefined();
      expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
    });

    it('should add @ngrx/store-devtools when "addDevTools: true"', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createNgModuleApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
        addDevTools: true,
      });

      // ASSERT
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBe(
        ngrxVersion
      );
    });

    it('should not update package.json when --skipPackageJson=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createNgModuleApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
        skipPackageJson: true,
      });

      // ASSERT
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.dependencies['@ngrx/store']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/entity']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/component-store']).toBeUndefined();
      expect(packageJson.devDependencies['@ngrx/schematics']).toBeUndefined();
      expect(
        packageJson.devDependencies['@ngrx/store-devtools']
      ).toBeUndefined();
      expect(packageJson.devDependencies['jasmine-marbles']).toBeUndefined();
    });
  });

  describe('Standalone APIs', () => {
    it('should error when project does not exist', async () => {
      const tree = createTreeWithEmptyWorkspace();

      await expect(
        ngrxRootStoreGenerator(tree, {
          project: 'non-exist',
          minimal: true,
          name: '',
        })
      ).rejects.toThrowError();
    });

    it('should error when minimal false, but name is undefined or falsy', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createStandaloneApp(tree);

      // ACT & ASSERT
      await expect(
        ngrxRootStoreGenerator(tree, {
          project: 'my-app',
          minimal: false,
          name: undefined,
        })
      ).rejects.toThrowError();
    });

    it('should add an empty root module when --minimal=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createStandaloneApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
      });

      // ASSERT
      expect(
        tree.read('my-app/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('/my-app/src/app/+state/users.actions.ts')).toBe(
        false
      );
      expect(tree.exists('/my-app/src/app/+state/users.effects.ts')).toBe(
        false
      );
      expect(tree.exists('/my-app/src/app/+state/users.effects.spec.ts')).toBe(
        false
      );
      expect(tree.exists('/my-app/src/app/+state/users.reducer.ts')).toBe(
        false
      );
      expect(tree.exists('/my-app/src/app/+state/users.selectors.ts')).toBe(
        false
      );
      expect(
        tree.exists('/my-app/src/app/+state/users.selectors.spec.ts')
      ).toBe(false);
    });

    it('should add a root module and root state when --minimal=false', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createStandaloneApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: false,
        name: 'users',
      });

      // ASSERT
      expect(
        tree.read('my-app/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.actions.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.effects.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.effects.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.reducer.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.selectors.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.selectors.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add a facade when --facade=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createStandaloneApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: false,
        name: 'users',
        facade: true,
      });

      // ASSERT
      expect(
        tree.read('my-app/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('/my-app/src/app/+state/users.facade.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should instrument the store devtools when "addDevTools: true"', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createStandaloneApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
        addDevTools: true,
      });

      // ASSERT
      expect(
        tree.read('my-app/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should update package.json', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createStandaloneApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
      });

      // ASSERT
      const packageJson = readJson(tree, 'package.json');
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
      expect(
        packageJson.devDependencies['@ngrx/store-devtools']
      ).toBeUndefined();
      expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
    });

    it('should add @ngrx/store-devtools when "addDevTools: true"', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createStandaloneApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
        addDevTools: true,
      });

      // ASSERT
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBe(
        ngrxVersion
      );
    });

    it('should not update package.json when --skipPackageJson=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await createStandaloneApp(tree);

      // ACT
      await ngrxRootStoreGenerator(tree, {
        project: 'my-app',
        minimal: true,
        skipPackageJson: true,
      });

      // ASSERT
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.dependencies['@ngrx/store']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/entity']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeUndefined();
      expect(packageJson.dependencies['@ngrx/component-store']).toBeUndefined();
      expect(packageJson.devDependencies['@ngrx/schematics']).toBeUndefined();
      expect(
        packageJson.devDependencies['@ngrx/store-devtools']
      ).toBeUndefined();
      expect(packageJson.devDependencies['jasmine-marbles']).toBeUndefined();
    });
  });
});

async function createNgModuleApp(tree: Tree, name = 'my-app') {
  await generateTestApplication(tree, {
    name,
    standalone: false,
    routing: true,
  });
}

async function createStandaloneApp(tree: Tree, name = 'my-app') {
  await generateTestApplication(tree, {
    name,
    standalone: true,
    routing: true,
  });
}
