import { addProjectConfiguration, readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './update-swcrc';

describe('Migration: update .swcrc', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove invalid options for ES6 modules', async () => {
    addProjectConfiguration(tree, 'pkg', {
      root: 'pkg',
    });
    writeJson(tree, 'pkg/.swcrc', {
      module: {
        type: 'es6',
        strict: true,
        noInterop: true,
      },
    });

    await update(tree);

    expect(readJson(tree, 'pkg/.swcrc')).toEqual({
      module: {
        type: 'es6',
      },
    });
  });

  it('should keep options for CommonJS modules', async () => {
    addProjectConfiguration(tree, 'pkg', {
      root: 'pkg',
    });
    writeJson(tree, 'pkg/.swcrc', {
      module: {
        type: 'commonjs',
        strict: true,
        noInterop: true,
      },
    });

    await update(tree);

    expect(readJson(tree, 'pkg/.swcrc')).toEqual({
      module: {
        type: 'commonjs',
        strict: true,
        noInterop: true,
      },
    });
  });

  it('should ignore projects without module options in .swcrc', async () => {
    addProjectConfiguration(tree, 'pkg', {
      root: 'pkg',
    });
    writeJson(tree, 'pkg/.swcrc', {
      jsc: {
        target: 'es2017',
      },
    });

    await expect(update(tree)).resolves.not.toThrow();

    expect(readJson(tree, 'pkg/.swcrc')).toEqual({
      jsc: {
        target: 'es2017',
      },
    });
  });

  it('should ignore projects without .swcrc', async () => {
    addProjectConfiguration(tree, 'pkg', {
      root: 'pkg',
    });

    await expect(update(tree)).resolves.not.toThrow();
  });
});
