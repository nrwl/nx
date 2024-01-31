import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-symlink-target';

describe('remove-symlink-target', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        'ensure-symlink': {
          executor: '@nx/expo:ensure-symlink',
          options: {},
        },
        export: {
          executor: '@nx/expo:export',
          options: {
            platform: 'all',
            outputDir: '../../dist/apps/dogs',
          },
          dependsOn: ['ensure-symlink', 'sync-deps'],
        },
      },
    });
  });

  it(`should remove ensure-symlink target from project.json`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['ensure-symlink']).toBeUndefined();
      expect(project.targets['export'].dependsOn).toEqual(['sync-deps']);
    });
  });
});
