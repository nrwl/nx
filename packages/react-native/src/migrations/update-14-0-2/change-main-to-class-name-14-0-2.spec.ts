import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './change-main-to-class-name-14-0-2';

describe('Change from main tag to className tag', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        start: {
          executor: '@nrwl/react-native:start',
          options: {
            port: 8081,
          },
        },
      },
    });
  });

  it(`should udpate main file to registerComponent className`, async () => {
    tree.write(
      'apps/products/src/main.tsx',
      `AppRegistry.registerComponent('main', () => App);`
    );
    await update(tree);

    expect(tree.read('apps/products/src/main.tsx', 'utf-8')).toEqual(
      `AppRegistry.registerComponent('Products', () => App);`
    );
  });

  it(`should not udpate main file to registerComponent className if it does not exists`, async () => {
    tree.write(
      'apps/products/src/main.tsx',
      `AppRegistry.registerComponent('otherTagName', () => App);`
    );
    await update(tree);

    expect(tree.read('apps/products/src/main.tsx', 'utf-8')).toEqual(
      `AppRegistry.registerComponent('otherTagName', () => App);`
    );
  });
});
