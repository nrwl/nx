import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './change-searchDir-storybook';

describe('change-searchDir-storybook', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        storybook: {
          executor: '@nrwl/react-native:storybook',
          options: {
            searchDir: 'apps/products',
          },
        },
      },
    });
  });

  it(`should change searchDir from string to array`, async () => {
    await update(tree);

    const projectConfig = readProjectConfiguration(tree, 'products');
    expect(projectConfig.targets['storybook']).toEqual({
      executor: '@nrwl/react-native:storybook',
      options: {
        searchDir: ['apps/products'],
      },
    });
  });
});
