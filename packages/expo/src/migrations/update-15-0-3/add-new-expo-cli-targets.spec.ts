import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-new-expo-cli-targets';

describe('add-eas-update-target', () => {
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

  it(`should update project.json with target prebuild, install and eject`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['eject']).toEqual({
        executor: 'nx:run-commands',
        options: {
          command: `nx prebuild product`,
        },
      });
      expect(project.targets['install']).toEqual({
        executor: '@nrwl/expo:install',
        options: {},
      });
      expect(project.targets['prebuild']).toEqual({
        executor: '@nrwl/expo:prebuild',
        options: {},
      });
      expect(project.targets['update']).toEqual({
        executor: '@nrwl/expo:update',
        options: {},
      });
    });
  });
});
