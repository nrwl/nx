import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { checkProjectIsSafeToRemove } from './check-project-is-safe-to-remove';

describe('checkProjectIsSafeToRemove', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });
  it('should not remove the root project', () => {
    addProjectConfiguration(tree, 'root-project', {
      root: '.',
    });

    expect(() => {
      checkProjectIsSafeToRemove(
        tree,
        {
          projectName: 'root-project',
          forceRemove: false,
          skipFormat: false,
        },
        readProjectConfiguration(tree, 'root-project')
      );
    }).toThrow();
  });

  it('should not remove the projects containing other projects', () => {
    addProjectConfiguration(tree, 'parent-project', {
      root: 'parent',
    });
    addProjectConfiguration(tree, 'nested-project', {
      root: 'parent/nested',
    });

    expect(() => {
      checkProjectIsSafeToRemove(
        tree,
        {
          projectName: 'parent-project',
          forceRemove: false,
          skipFormat: false,
        },
        readProjectConfiguration(tree, 'parent-project')
      );
    }).toThrow();
  });

  it('should be able to remove e2e project in standalone', () => {
    addProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
    });
    addProjectConfiguration(tree, 'root', {
      root: '.',
    });

    expect(() => {
      checkProjectIsSafeToRemove(
        tree,
        {
          projectName: 'e2e',
          forceRemove: false,
          skipFormat: false,
        },
        readProjectConfiguration(tree, 'e2e')
      );
    }).not.toThrow();
  });
});
