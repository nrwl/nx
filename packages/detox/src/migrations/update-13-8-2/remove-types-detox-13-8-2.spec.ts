import {
  addProjectConfiguration,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-types-detox-13-8-2';

describe('remove-types-detox-13-8-2', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (packageJson) => {
      packageJson.devDependencies['@types/detox'] = '*';
      return packageJson;
    });
    addProjectConfiguration(tree, 'products-e2e', {
      root: 'apps/products-e2e',
      sourceRoot: 'apps/products-e2e/src',
      targets: {
        'test-ios': {
          executor: '@nrwl/detox:test',
        },
      },
    });
  });

  it(`should remove @types/detox from package.json`, async () => {
    await update(tree);
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@types/detox']).toBeUndefined();
  });
});
