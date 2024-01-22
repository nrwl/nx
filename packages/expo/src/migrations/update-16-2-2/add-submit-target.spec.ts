import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-submit-target';

describe('add-submit-target', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        start: {
          executor: '@nx/expo:start',
        },
      },
    });
  });

  it(`should update project.json with target submit`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['submit']).toEqual({
        executor: '@nx/expo:submit',
        options: {},
      });
    });
  });
});
