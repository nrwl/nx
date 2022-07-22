import {
  addProjectConfiguration,
  readJson,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateLibrariesSecondaryEntrypoints from './update-libraries-secondary-entrypoints';

const libraryExecutors = [
  '@angular-devkit/build-angular:ng-packagr',
  '@nrwl/angular:ng-packagr-lite',
  '@nrwl/angular:package',
];

describe('update-libraries-secondary-entrypoints migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it.each(libraryExecutors)(
    'should not delete "package.json" of the primary entrypoint (%s)',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        targets: { build: { executor } },
      });
      writeJson(tree, 'libs/lib1/package.json', { version: '0.0.0' });

      await updateLibrariesSecondaryEntrypoints(tree);

      expect(tree.exists('libs/lib1/package.json')).toBe(true);
    }
  );

  it.each(libraryExecutors)(
    'should delete "package.json" of the secondary entrypoint (%s)',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        targets: { build: { executor } },
      });
      writeJson(tree, 'libs/lib1/package.json', { version: '0.0.0' });
      writeJson(tree, 'libs/lib1/secondary/package.json', {
        version: '0.0.0',
        ngPackage: { lib: { entryFile: 'src/index.ts' } },
      });

      await updateLibrariesSecondaryEntrypoints(tree);

      expect(tree.exists('libs/lib1/secondary/package.json')).toBe(false);
    }
  );

  it.each(libraryExecutors)(
    'should move ng-packagr configuration from "package.json" to "ng-package.json" (%s)',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        targets: { build: { executor } },
      });
      writeJson(tree, 'libs/lib1/package.json', { version: '0.0.0' });
      writeJson(tree, 'libs/lib1/secondary/package.json', {
        version: '0.0.0',
        ngPackage: { lib: { entryFile: 'src/index.ts' } },
      });

      await updateLibrariesSecondaryEntrypoints(tree);

      expect(
        readJson(tree, 'libs/lib1/secondary/ng-package.json')
      ).toStrictEqual({
        lib: { entryFile: 'src/index.ts' },
      });
    }
  );

  it('should do nothing when not using any of the relevant executors', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: { test: { executor: '@nrwl/jest:jest' } },
    });
    writeJson(tree, 'libs/lib1/package.json', { version: '0.0.0' });
    writeJson(tree, 'libs/lib1/secondary/package.json', {
      version: '0.0.0',
      ngPackage: { lib: { entryFile: 'src/index.ts' } },
    });

    await updateLibrariesSecondaryEntrypoints(tree);

    expect(tree.exists('libs/lib1/package.json')).toBe(true);
    expect(tree.exists('libs/lib1/secondary/package.json')).toBe(true);
    expect(tree.exists('libs/lib1/secondary/ng-package.json')).toBe(false);
  });
});
