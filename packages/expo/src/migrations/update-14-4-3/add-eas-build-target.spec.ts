import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-eas-build-target';

describe('add-eas-build-target', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
      expect(project.targets['build']).toEqual({
        executor: '@nrwl/expo:build',
        options: {},
      });
      expect(project.targets['build-list']).toEqual({
        executor: '@nrwl/expo:build-list',
        options: {},
      });
      expect(project.targets['download']).toEqual({
        executor: '@nrwl/expo:download',
        options: {
          output: 'apps/product/dist',
        },
      });
    });
  });
});
