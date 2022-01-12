import { addProjectConfiguration, getProjects, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './add-build-target-test-13-5-0';

describe('add-e2e-targets-13-5-0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'products-e2e', {
      root: 'apps/products-e2e',
      sourceRoot: 'apps/products-e2e/src',
      targets: {
        'test-ios': {
          executor: '@nrwl/detox:test',
          options: {
            detoxConfiguration: 'ios.sim.debug',
          },
          configurations: {
            production: {
              detoxConfiguration: 'ios.sim.release',
            },
          },
        },
        'test-android': {
          executor: '@nrwl/detox:test',
          options: {
            detoxConfiguration: 'android.emu.debug',
          },
          configurations: {
            production: {
              detoxConfiguration: 'android.emu.release',
            },
          },
        },
      },
    });
  });

  it(`should update project.json with targets e2e`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['test-ios']).toEqual({
        executor: '@nrwl/detox:test',
        options: {
          detoxConfiguration: 'ios.sim.debug',
          buildTarget: 'products-e2e:build-ios',
        },
        configurations: {
          production: {
            detoxConfiguration: 'ios.sim.release',
            buildTarget: 'products-e2e:build-ios:prod',
          },
        },
      });

      expect(project.targets['test-android']).toEqual({
        executor: '@nrwl/detox:test',
        options: {
          detoxConfiguration: 'android.emu.debug',
          buildTarget: 'products-e2e:build-android',
        },
        configurations: {
          production: {
            detoxConfiguration: 'android.emu.release',
            buildTarget: 'products-e2e:build-android:prod',
          },
        },
      });
    });
  });
});
