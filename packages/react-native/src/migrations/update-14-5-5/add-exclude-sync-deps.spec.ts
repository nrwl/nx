import { addProjectConfiguration, getProjects, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import update from './add-exclude-sync-deps';

describe('add-exclude-sync-deps', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyV1Workspace();
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        'sync-deps': {
          executor: '@nrwl/react-native:sync-deps',
          options: {
            include: 'react-native-reanmiated,react-native-screens',
          },
        },
      },
    });
  });

  it(`should change include from string to array`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['sync-deps']).toEqual({
        executor: '@nrwl/react-native:sync-deps',
        options: {
          include: ['react-native-reanmiated', 'react-native-screens'],
        },
      });
    });
  });
});
