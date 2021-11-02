import type { Tree } from '@nrwl/devkit';
import { updateJson, joinPathFragments, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import libGenerator from '../../generators/library/library';
import updateInvalidImportPaths from './update-invalid-import-paths';

describe('Migration to fix invalid import paths in affected workspaces', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    // set up some libs

    await libGenerator(tree, {
      name: 'buildable1',
      buildable: true,
      directory: 'dir1',
    });

    await libGenerator(tree, {
      name: 'buildable2',
      buildable: true,
      directory: 'dir1',
    });

    await libGenerator(tree, {
      name: 'publishable1',
      publishable: true,
      directory: 'dir1',
      importPath: '@proj/publishable1',
    });

    await libGenerator(tree, {
      name: 'publishable2',
      publishable: true,
      directory: 'dir1',
      importPath: '@proj/publishable2',
    });

    // break one of each kind
    updateJson(
      tree,
      joinPathFragments('libs/dir1/buildable1', 'package.json'),
      (pkgJson) => {
        pkgJson.name = '@proj/dir1-buildable1';
        return pkgJson;
      }
    );

    updateJson(tree, 'tsconfig.base.json', (tsconfig) => {
      const srcPath = tsconfig['@proj/publishable2'];
      tsconfig['@proj/publishable2'] = undefined;

      tsconfig['@proj/dir1/publishable2'] = srcPath;

      return tsconfig;
    });
  });

  it('should fix the invalid libraries', async () => {
    // ACT
    await updateInvalidImportPaths(tree);

    // ASSERT
    const fixedBuildable = readJson(
      tree,
      joinPathFragments('libs/dir1/buildable1', 'package.json')
    );

    const { compilerOptions } = readJson<{
      compilerOptions: { paths: Record<string, string[]> };
    }>(tree, 'tsconfig.base.json');
    const { paths: tsConfigPaths } = compilerOptions;
    const fixedPublishable = Boolean(tsConfigPaths['@proj/publishable2']);
    const brokenPublishableShouldntExist = !Boolean(
      tsConfigPaths['@proj/publishable2']
    );

    expect(fixedBuildable.name).toEqual('@proj/dir1/buildable1');
    expect(fixedPublishable).toBeTruthy();
    expect(brokenPublishableShouldntExist).toBeFalsy();
  });

  it('should fix the invalid libraries when base tsconfig is not tsconfig.base.json', async () => {
    // ARRANGE
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    // ACT
    await updateInvalidImportPaths(tree);

    // ASSERT
    const fixedBuildable = readJson(
      tree,
      joinPathFragments('libs/dir1/buildable1', 'package.json')
    );

    const { compilerOptions } = readJson<{
      compilerOptions: { paths: Record<string, string[]> };
    }>(tree, 'tsconfig.json');
    const { paths: tsConfigPaths } = compilerOptions;
    const fixedPublishable = Boolean(tsConfigPaths['@proj/publishable2']);
    const brokenPublishableShouldntExist = !Boolean(
      tsConfigPaths['@proj/publishable2']
    );

    expect(fixedBuildable.name).toEqual('@proj/dir1/buildable1');
    expect(fixedPublishable).toBeTruthy();
    expect(brokenPublishableShouldntExist).toBeFalsy();
  });
});
