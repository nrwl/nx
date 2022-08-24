import { addProjectConfiguration, Tree, getProjects } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './update-entry-file-bundle-14-0-0';

describe('Update entryFile for bundle target for react native apps', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        'bundle-ios': {
          executor: '@nrwl/react-native:bundle',
          options: {
            entryFile: 'apps/mobile/src/main.tsx',
            platform: 'ios',
            bundleOutput: 'dist/apps/mobile/ios/main.jsbundle',
          },
        },
        'bundle-android': {
          executor: '@nrwl/react-native:bundle',
          options: {
            entryFile: 'apps/mobile/src/main.tsx',
            platform: 'android',
            bundleOutput: 'dist/apps/mobile/android/main.jsbundle',
          },
        },
      },
    });
  });

  it(`should update entryFile option`, async () => {
    tree.write('apps/products/src/main.tsx', '');

    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['bundle-ios']).toEqual({
        executor: '@nrwl/react-native:bundle',
        options: {
          entryFile: 'src/main.tsx',
          platform: 'ios',
          bundleOutput: 'dist/apps/mobile/ios/main.jsbundle',
        },
      });

      expect(project.targets['bundle-android']).toEqual({
        executor: '@nrwl/react-native:bundle',
        options: {
          entryFile: 'src/main.tsx',
          platform: 'android',
          bundleOutput: 'dist/apps/mobile/android/main.jsbundle',
        },
      });
    });
  });

  it(`should not update entryFile option if the file does not exist`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['bundle-ios']).toEqual({
        executor: '@nrwl/react-native:bundle',
        options: {
          entryFile: 'apps/mobile/src/main.tsx',
          platform: 'ios',
          bundleOutput: 'dist/apps/mobile/ios/main.jsbundle',
        },
      });

      expect(project.targets['bundle-android']).toEqual({
        executor: '@nrwl/react-native:bundle',
        options: {
          entryFile: 'apps/mobile/src/main.tsx',
          platform: 'android',
          bundleOutput: 'dist/apps/mobile/android/main.jsbundle',
        },
      });
    });
  });
});
