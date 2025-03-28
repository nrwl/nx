import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-upgrade-target';

describe('add-upgrade-target', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        start: {
          executor: '@nx/react-native:start',
          options: {},
        },
        serve: {
          executor: 'nx:run-commands',
          options: {
            command: 'nx start product',
          },
        },
      },
    });
  });

  it(`should add upgrade target`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets?.['upgrade']).toEqual({
        executor: '@nx/react-native:upgrade',
        options: {},
      });
    });
  });
});
