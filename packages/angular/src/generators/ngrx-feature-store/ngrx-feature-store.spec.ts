import type { Tree } from '@nx/devkit';
import { readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import libraryGenerator from '../library/library';
import ngrxFeatureStoreGenerator from './ngrx-feature-store';
import { ngrxVersion } from '../../utils/versions';

describe('ngrx-feature-store', () => {
  describe('NgModule', () => {
    const parent = 'feature-module/src/lib/feature-module.module.ts';
    it('should error when parent cannot be found', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT && ASSERT
      await expect(
        ngrxFeatureStoreGenerator(tree, {
          name: 'users',
          minimal: true,
          directory: '+state',
          parent,
        })
      ).rejects.toThrowError(
        `Parent does not exist: feature-module/src/lib/feature-module.module.ts.`
      );
    });

    it('should update package.json', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addNgModuleLib(tree);

      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: true,
        directory: '+state',
        parent,
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
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toEqual(
        ngrxVersion
      );
      expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
    });

    it('should not update package.json when --skipPackageJson=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addNgModuleLib(tree);

      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: true,
        directory: '+state',
        skipPackageJson: true,
        parent,
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

    it('should generate files without a facade by default', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addNgModuleLib(tree);
      const statePath = 'feature-module/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        directory: '+state',
        parent,
      });

      // ASSERT
      expect(tree.exists(`${statePath}/users.facade.ts`)).not.toBeTruthy();
      expect(tree.exists(`${statePath}/users.facade.spec.ts`)).not.toBeTruthy();
      expect(tree.exists(`${statePath}/users.actions.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.models.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.spec.ts`)).toBeTruthy();
    });

    it('should generate files with a facade when --facade=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addNgModuleLib(tree);
      const statePath = 'feature-module/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        directory: '+state',
        facade: true,
        parent,
      });

      // ASSERT
      expect(tree.exists(`${statePath}/users.facade.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.facade.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.actions.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.models.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.spec.ts`)).toBeTruthy();
    });

    it('should generate files in a custom directory when --directory=custom', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addNgModuleLib(tree);
      const statePath = 'feature-module/src/lib/custom';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        directory: 'custom',
        facade: true,
        parent,
      });

      // ASSERT
      expect(tree.exists(`${statePath}/users.facade.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.facade.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.actions.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.models.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.spec.ts`)).toBeTruthy();
    });

    it('should generate the files with the correct content', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addNgModuleLib(tree);
      const statePath = 'feature-module/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        directory: '+state',
        facade: true,
        parent,
      });

      // ASSERT
      expect(tree.read(parent, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.facade.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.facade.spec.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.actions.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.effects.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.effects.spec.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.models.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.reducer.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.reducer.spec.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.selectors.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.selectors.spec.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should have the correct entry point when --barrels=false', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addNgModuleLib(tree);
      const statePath = 'feature-module/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        directory: '+state',
        facade: true,
        parent,
      });

      // ASSERT
      expect(
        tree.read(`feature-module/src/index.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should have the correct entry point when --barrels=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addNgModuleLib(tree);
      const statePath = 'feature-module/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        directory: '+state',
        facade: true,
        parent,
        barrels: true,
      });

      // ASSERT
      expect(
        tree.read(`feature-module/src/index.ts`, 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('Standalone APIs', () => {
    const parent = 'feature/src/lib/lib.routes.ts';
    it('should error when parent cannot be found', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT && ASSERT
      await expect(
        ngrxFeatureStoreGenerator(tree, {
          name: 'users',
          minimal: true,
          directory: '+state',
          parent,
        })
      ).rejects.toThrowError(
        `Parent does not exist: feature/src/lib/lib.routes.ts`
      );
    });

    it('should update package.json', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addStandaloneLib(tree);

      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: true,
        parent,
        directory: '+state',
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
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toEqual(
        ngrxVersion
      );
      expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
    });

    it('should not update package.json when --skipPackageJson=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addStandaloneLib(tree);

      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: true,
        parent,
        directory: '+state',
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

    it('should generate files without a facade by default', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addStandaloneLib(tree);
      const statePath = 'feature/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        parent,
        directory: '+state',
      });

      // ASSERT
      expect(tree.exists(`${statePath}/users.facade.ts`)).not.toBeTruthy();
      expect(tree.exists(`${statePath}/users.facade.spec.ts`)).not.toBeTruthy();
      expect(tree.exists(`${statePath}/users.actions.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.models.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.spec.ts`)).toBeTruthy();
    });

    it('should generate files with a facade when --facade=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addStandaloneLib(tree);
      const statePath = 'feature/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        parent,
        directory: '+state',
        facade: true,
      });

      // ASSERT
      expect(tree.exists(`${statePath}/users.facade.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.facade.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.actions.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.models.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.spec.ts`)).toBeTruthy();
    });

    it('should generate files in a custom directory when --directory=custom', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addStandaloneLib(tree);
      const statePath = 'feature/src/lib/custom';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        parent,
        directory: 'custom',
        facade: true,
      });

      // ASSERT
      expect(tree.exists(`${statePath}/users.facade.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.facade.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.actions.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.effects.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.models.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.reducer.spec.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.ts`)).toBeTruthy();
      expect(tree.exists(`${statePath}/users.selectors.spec.ts`)).toBeTruthy();
    });

    it('should generate the files with the correct content', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addStandaloneLib(tree);
      const statePath = 'feature/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        parent,
        directory: '+state',
        facade: true,
      });

      // ASSERT
      expect(
        tree.read(`${statePath}/users.facade.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.facade.spec.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.actions.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.effects.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.effects.spec.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.models.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.reducer.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.reducer.spec.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.selectors.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`${statePath}/users.selectors.spec.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`feature/src/lib/lib.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should have the correct entry point when --barrels=false', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addStandaloneLib(tree);
      const statePath = 'feature/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        parent,
        directory: '+state',
        facade: true,
      });

      // ASSERT
      expect(tree.read(`feature/src/index.ts`, 'utf-8')).toMatchSnapshot();
    });

    it('should have the correct entry point when --barrels=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await addStandaloneLib(tree);
      const statePath = 'feature/src/lib/+state';
      // ACT
      await ngrxFeatureStoreGenerator(tree, {
        name: 'users',
        minimal: false,
        parent,
        directory: '+state',
        facade: true,
        barrels: true,
      });

      // ASSERT
      expect(tree.read(`feature/src/index.ts`, 'utf-8')).toMatchSnapshot();
    });
  });
});

async function addNgModuleLib(tree: Tree, name = 'feature-module') {
  await libraryGenerator(tree, {
    name,
    standalone: false,
  });
}

async function addStandaloneLib(tree: Tree, name = 'feature') {
  await libraryGenerator(tree, {
    name,
    standalone: true,
    routing: true,
  });
}
