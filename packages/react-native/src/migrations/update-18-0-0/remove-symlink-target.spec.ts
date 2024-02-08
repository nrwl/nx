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
          executor: '@nx/react-native:ensure-symlink',
          options: {},
        },
        'bundle-android': {
          executor: '@nx/react-native:bundle',
          dependsOn: ['ensure-symlink'],
          outputs: ['{options.bundleOutput}'],
          options: {
            entryFile: 'src/main.tsx',
            platform: 'android',
            bundleOutput: 'dist/apps/techy-jokes/android/main.jsbundle',
          },
        },
      },
    });
  });

  it(`should remove ensure-symlink target from project.json`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['ensure-symlink']).toBeUndefined();
      expect(project.targets['bundle-android'].dependsOn).toEqual([]);
    });
  });
});
