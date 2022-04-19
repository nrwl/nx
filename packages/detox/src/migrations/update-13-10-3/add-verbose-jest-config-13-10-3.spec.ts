import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './add-verbose-jest-config-13-10-3';

describe('Set verbose to true for jest.config.json for detox apps', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        'test-ios': {
          executor: '@nrwl/detox:test',
        },
      },
    });
  });

  it(`should add verbose true to jest.config.json`, async () => {
    tree.write('apps/products/jest.config.json', '{}');
    await update(tree);

    const jestConfig = readJson(tree, 'apps/products/jest.config.json');
    expect(jestConfig.verbose).toEqual(true);
  });

  it(`should change verbose to true in jest.config.json`, async () => {
    tree.write('apps/products/jest.config.json', '{"verbose": false}');
    await update(tree);

    const jestConfig = readJson(tree, 'apps/products/jest.config.json');
    expect(jestConfig.verbose).toEqual(true);
  });
});
