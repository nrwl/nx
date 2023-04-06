import type { Tree } from '@nrwl/devkit';
import { Linter } from '@nrwl/linter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { normalizeOptions } from './normalize-options';

describe('normalizeOptions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set importPath and projectRoot', () => {
    const options = normalizeOptions(tree, {
      name: 'my-lib',
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
