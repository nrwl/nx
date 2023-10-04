import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-build-ios-target';

describe('add-build-ios-target', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        start: {
          executor: '@nrwl/react-native:start',
        },
      },
    });
  });

  it(`should update project.json with target build-ios and pod-install`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['build-ios']).toEqual({
        executor: '@nrwl/react-native:build-ios',
        outputs: ['{projectRoot}/ios/build/Build'],
        options: {},
      });
      expect(project.targets['pod-install']).toEqual({
        executor: '@nrwl/react-native:pod-install',
        options: {},
      });
    });
  });
});
