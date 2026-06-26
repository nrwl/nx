import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, type Tree, writeJson } from '@nx/devkit';
import update from './add-node-types-to-ts-node-config';

describe('add-node-types-to-ts-node-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('adds types: ["node"] to a ts-node block using node10 without types', async () => {
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' },
      'ts-node': {
        compilerOptions: { module: 'commonjs', moduleResolution: 'node10' },
      },
    });

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
    expect(json['ts-node'].compilerOptions.types).toEqual(['node']);
    // the main compilerOptions must stay untouched
    expect(json.compilerOptions.types).toBeUndefined();
  });

  it('leaves a ts-node block that already declares types', async () => {
    writeJson(tree, 'tsconfig.json', {
      'ts-node': {
        compilerOptions: {
          moduleResolution: 'node10',
          types: ['node', 'jest'],
        },
      },
    });

    await update(tree);

    expect(
      readJson(tree, 'tsconfig.json')['ts-node'].compilerOptions.types
    ).toEqual(['node', 'jest']);
  });

  it('ignores ts-node blocks not using a node-style resolution', async () => {
    writeJson(tree, 'tsconfig.json', {
      'ts-node': { compilerOptions: { moduleResolution: 'bundler' } },
    });

    await update(tree);

    expect(
      readJson(tree, 'tsconfig.json')['ts-node'].compilerOptions.types
    ).toBeUndefined();
  });

  it('does not touch tsconfigs without a ts-node block', async () => {
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: { moduleResolution: 'node10' },
    });

    await update(tree);

    expect(
      readJson(tree, 'tsconfig.json').compilerOptions.types
    ).toBeUndefined();
  });
});
