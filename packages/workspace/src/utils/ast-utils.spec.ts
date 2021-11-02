import {
  readJsonInTree,
  renameSyncInTree,
  renameDirSyncInTree,
  addDepsToPackageJson,
} from './ast-utils';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { Tree, SchematicContext, TaskId } from '@angular-devkit/schematics';
import { serializeJson } from '../utilities/fileutils';
import { createEmptyWorkspace } from './testing-utils';

describe('readJsonInTree', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
  });
  it('should read JSON from the tree', () => {
    tree.create(
      'data.json',
      serializeJson({
        data: 'data',
      })
    );
    expect(readJsonInTree(tree, 'data.json')).toEqual({
      data: 'data',
    });
  });

  it('should handle json files with comments', () => {
    tree.create(
      'data.json',
      `{
      // data: 'data'
      }`
    );
    expect(readJsonInTree(tree, 'data.json')).toEqual({});
  });

  it('should throw an error if the file does not exist', () => {
    expect(() => readJsonInTree(tree, 'data.json')).toThrow(
      'Cannot find data.json'
    );
  });

  it('should throw an error if the file cannot be parsed', () => {
    tree.create('data.json', `{ data: 'data'`);
    expect(() => readJsonInTree(tree, 'data.json')).toThrow(
      'Cannot parse data.json: InvalidSymbol in JSON at position 2'
    );
  });
});

describe('renameSyncInTree', () => {
  let tree: UnitTestTree;

  beforeEach(() => {
    tree = new UnitTestTree(Tree.empty());
  });

  it('should rename a file in the tree', () => {
    const content = 'my content';
    tree.create('/a', content);
    renameSyncInTree(tree, '/a', '/b', (err) => {
      expect(err).toBeFalsy();
      expect(content).toEqual(tree.readContent('/b'));
    });
  });

  it('should rename a file in the tree to a nested dir', () => {
    const content = 'my content';
    tree.create('/a', content);
    renameSyncInTree(tree, '/a', '/x/y/z/b', (err) => {
      expect(err).toBeFalsy();
      expect(content).toEqual(tree.readContent('/x/y/z/b'));
    });
  });

  it('should rename without corrupting binary files', () => {
    const content = Buffer.from([0xca, 0xc5, 0x0e]);
    tree.create('/a', content);
    renameSyncInTree(tree, '/a', '/b', (err) => {
      expect(err).toBeFalsy();
    });
    expect(Buffer.compare(content, tree.read('/b'))).toEqual(0);
  });
});

describe('renameDirSyncInTree', () => {
  let tree: UnitTestTree;

  beforeEach(() => {
    tree = new UnitTestTree(Tree.empty());
  });

  it('should rename a dir in the tree', () => {
    const content = 'my content';
    tree.create('/dir/a', content);
    tree.create('/dir/b', content);
    renameDirSyncInTree(tree, 'dir', '/newdir', (err) => {
      expect(err).toBeFalsy();
      expect(tree.files).toContain('/newdir/a');
      expect(tree.files).toContain('/newdir/b');
      expect(tree.files).not.toContain('/dir/a');
      expect(tree.files).not.toContain('/dir/b');
    });
  });

  it('should rename a dir in the tree, with sub dirs', () => {
    const content = 'my content';
    tree.create('/dir/a', content);
    tree.create('/dir/b', content);
    tree.create('/dir/sub1/c', content);
    tree.create('/dir/sub1/d', content);
    tree.create('/dir/sub1/sub2/e', content);
    tree.create('/dir/sub1/sub2/f', content);
    renameDirSyncInTree(tree, 'dir', '/newdir', (err) => {
      expect(err).toBeFalsy();
      expect(tree.files).toContain('/newdir/a');
      expect(tree.files).toContain('/newdir/b');
      expect(tree.files).not.toContain('/dir/a');
      expect(tree.files).not.toContain('/dir/b');
      expect(tree.files).toContain('/newdir/sub1/c');
      expect(tree.files).toContain('/newdir/sub1/d');
      expect(tree.files).not.toContain('/dir/sub1/c');
      expect(tree.files).not.toContain('/dir/sub1/d');
      expect(tree.files).toContain('/newdir/sub1/sub2/e');
      expect(tree.files).toContain('/newdir/sub1/sub2/f');
      expect(tree.files).not.toContain('/dir/sub1/sub2/e');
      expect(tree.files).not.toContain('/dir/sub1/sub2/f');
    });
  });
});

describe('addDepsToPackageJson', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should not update the package.json if dependencies have already been added', async () => {
    const devDeps = {
      '@nrwl/jest': '1.2.3',
    };

    appTree.overwrite(
      '/package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: {
          ...devDeps,
        },
      })
    );

    const testRunner = new SchematicTestRunner(
      '@nrwl/jest',
      join(__dirname, '../../../jest/generators.json')
    );

    await testRunner
      .callRule(() => {
        return addDepsToPackageJson({}, devDeps);
      }, appTree)
      .toPromise();

    expect(
      testRunner.tasks.find((x) => x.name === 'node-package')
    ).not.toBeDefined();
  });

  it('should update the package.json if some of the dependencies are missing', async () => {
    const devDeps = {
      '@nrwl/jest': '1.2.3',
      '@nrwl/workspace': '1.1.1',
    };

    appTree.overwrite(
      '/package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: {
          '@nrwl/jest': '1.2.3',
        },
      })
    );

    const testRunner = new SchematicTestRunner(
      '@nrwl/jest',
      join(__dirname, '../../../jest/generators.json')
    );

    await testRunner
      .callRule(() => {
        return addDepsToPackageJson({}, devDeps);
      }, appTree)
      .toPromise();

    expect(
      testRunner.tasks.find((x) => x.name === 'node-package')
    ).toBeDefined();
  });
});
