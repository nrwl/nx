import { addProjectConfiguration, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-detoxrc-json';

describe('Update detoxrc for detox 20', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        'test-ios': {
          executor: '@nx/detox:test',
        },
      },
    });
    tree.write('apps/products/jest.config.json', `{"transform": {}}`);
    tree.write('apps/products/.detoxrc.json', '{}');
  });

  it(`should update jest.config.json`, async () => {
    await update(tree);

    const jestConfig = readJson(tree, 'apps/products/jest.config.json');
    expect(jestConfig).toEqual({
      rootDir: '.',
      testMatch: [
        '<rootDir>/src/**/*.test.ts?(x)',
        '<rootDir>/src/**/*.spec.ts?(x)',
      ],
      globalSetup: 'detox/runners/jest/globalSetup',
      globalTeardown: 'detox/runners/jest/globalTeardown',
      reporter: ['detox/runners/jest/reporter'],
      verbose: true,
    });
  });

  it(`should update .detoxrc.json`, async () => {
    await update(tree);

    const detoxrcJson = readJson(tree, 'apps/products/.detoxrc.json');
    expect(detoxrcJson).toEqual({
      testRunner: {
        args: {
          $0: 'jest',
          config: './jest.config.json',
        },
        jest: {
          setupTimeout: 120000,
        },
      },
    });
  });
});
