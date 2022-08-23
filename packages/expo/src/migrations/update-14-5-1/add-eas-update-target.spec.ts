import { addProjectConfiguration, getProjects, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './add-eas-update-target';

describe('add-eas-update-target', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        start: {
          executor: '@nrwl/expo:start',
        },
      },
    });
  });

  it(`should update project.json with target build and build-list`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['update']).toEqual({
        executor: '@nrwl/expo:update',
        options: {},
      });
    });
  });
});
