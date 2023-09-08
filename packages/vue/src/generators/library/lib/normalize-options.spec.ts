import type { Tree } from '@nx/devkit';
import { Linter } from '@nx/linter';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { normalizeOptions } from './normalize-options';

describe('normalizeOptions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should set unitTestRunner=jest and bundler=none by default', async () => {
    const options = await normalizeOptions(tree, {
      name: 'test',
      linter: Linter.None,
      unitTestRunner: 'vitest',
    });

    expect(options).toMatchObject({
      bundler: 'none',
      unitTestRunner: 'vitest',
    });
  });

  it('should set unitTestRunner=vitest by default when bundler is vite', async () => {
    const options = await normalizeOptions(tree, {
      name: 'test',
      linter: Linter.None,
      bundler: 'vite',
      unitTestRunner: 'vitest',
    });

    expect(options).toMatchObject({
      bundler: 'vite',
      unitTestRunner: 'vitest',
    });
  });

  it('should set maintain unitTestRunner when bundler is vite', async () => {
    const options = await normalizeOptions(tree, {
      name: 'test',
      linter: Linter.None,
      bundler: 'vite',
      unitTestRunner: 'vitest',
    });

    expect(options).toMatchObject({
      bundler: 'vite',
      unitTestRunner: 'vitest',
    });
  });
});
