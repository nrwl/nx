import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { normalizeOptions } from './normalize-options';

describe('normalizeOptions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set importPath and projectRoot', async () => {
    const options = await normalizeOptions(tree, {
      directory: 'my-lib',
      style: 'css',
      linter: 'none',
      unitTestRunner: 'jest',
    });

    expect(options).toMatchObject({
      importPath: '@proj/my-lib',
      projectRoot: 'my-lib',
    });
  });
});
