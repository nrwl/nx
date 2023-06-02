import { addProjectConfiguration, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-detoxrc-json-expo';

describe('Update detoxrc for expo projects', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        'test-ios': {
          executor: '@nx/detox:test',
          options: {
            detoxConfiguration: 'ios.sim.eas',
          },
        },
        'build-ios': {
          executor: '@nx/detox:build',
          options: {
            detoxConfiguration: 'random value',
          },
        },
        'test-android': {
          executor: '@nx/detox:test',
          options: {
            detoxConfiguration: 'android.sim.eas',
          },
        },
        'build-android': {
          executor: '@nx/detox:build',
          options: {
            detoxConfiguration: 'random value',
          },
        },
      },
    });
    tree.write('apps/products/jest.config.json', `{"transform": {}}`);
    tree.write(
      'apps/products/.detoxrc.json',
      `{"apps": {"ios.eas": {}, "android.eas": {}, "ios.local": {}, "android.local": {}}}`
    );
  });

  it(`should update .detoxrc.json`, async () => {
    await update(tree);

    const detoxrcJson = readJson(tree, 'apps/products/.detoxrc.json');
    expect(detoxrcJson).toEqual({
      apps: {
        'ios.eas': {
          build:
            'npx nx run products:download --platform ios --distribution simulator --output=../../apps/products/dist/',
        },
        'android.eas': {
          build:
            'npx nx run products:download --platform android --distribution simulator --output=../../apps/products/dist/',
          type: 'android.apk',
        },
        'ios.local': {
          build:
            'npx nx run products:build --platform ios --profile preview --wait --local --no-interactive --output=../../apps/products/dist/Products.tar.gz',
        },
        'android.local': {
          build:
            'npx nx run products:build --platform android --profile preview --wait --local --no-interactive --output=../../apps/products/dist/Products.apk',
          type: 'android.apk',
        },
      },
    });
  });

  it(`should update project.json`, async () => {
    await update(tree);

    const projectJson = readJson(tree, 'apps/products/project.json');
    expect(projectJson).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'products',
      sourceRoot: 'apps/products/src',
      targets: {
        'build-android': {
          executor: '@nx/detox:build',
          options: {
            detoxConfiguration: 'android.sim.eas',
          },
        },
        'build-ios': {
          executor: '@nx/detox:build',
          options: {
            detoxConfiguration: 'ios.sim.eas',
          },
        },
        'test-android': {
          configurations: {
            bare: {
              buildTarget: 'products:build-android:bare',
              detoxConfiguration: 'android.emu.debug',
            },
            local: {
              buildTarget: 'products:build-android:local',
              detoxConfiguration: 'android.emu.local',
            },
            production: {
              buildTarget: 'products:build-android:production',
              detoxConfiguration: 'android.emu.release',
            },
          },
          executor: '@nx/detox:test',
          options: {
            buildTarget: 'products:build-android',
            detoxConfiguration: 'android.sim.eas',
          },
        },
        'test-ios': {
          executor: '@nx/detox:test',
          options: {
            detoxConfiguration: 'ios.sim.eas',
          },
        },
      },
    });
  });
});
