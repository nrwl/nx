import type { Tree } from '@nrwl/devkit';
import { Linter } from '@nrwl/linter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { normalizeOptions } from './normalize-options';

describe('normalizeOptions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set unitTestRunner=jest and bundler=rollup by default', async () => {
    const options = normalizeOptions(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
    });

    expect(options).toMatchObject({
      buildable: false,
      bundler: 'rollup',
      compiler: 'babel',
      unitTestRunner: 'jest',
    });
  });

  it('should set unitTestRunner=vitest by default when bundler is vite', async () => {
    const options = normalizeOptions(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      bundler: 'vite',
    });

    expect(options).toMatchObject({
      buildable: true,
      bundler: 'vite',
      compiler: 'babel',
      unitTestRunner: 'vitest',
    });
  });

  it('should set maintain unitTestRunner when bundler is vite', async () => {
    const options = normalizeOptions(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      bundler: 'vite',
      unitTestRunner: 'jest',
    });

    expect(options).toMatchObject({
      buildable: true,
      bundler: 'vite',
      compiler: 'babel',
      unitTestRunner: 'jest',
    });
  });
});
