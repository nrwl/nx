import type { Tree } from '@nx/devkit';
import { Linter } from '@nx/eslint';
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
      linter: Linter.None,
      unitTestRunner: 'jest',
    });

    expect(options).toMatchObject({
      importPath: '@proj/my-lib',
      projectRoot: 'my-lib',
    });
  });
});
