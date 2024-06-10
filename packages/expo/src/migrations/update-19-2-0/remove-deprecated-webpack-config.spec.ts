import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-deprecated-webpack-config';

describe('remove-deprecated-webpack-config', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        start: {
          executor: '@nx/expo:start',
        },
      },
    });
    tree.write(
      `apps/product/webpack.config.js`,
      'module.exports = { /* webpack config */ };'
    );
  });

  it(`should remove webpack.config.js`, async () => {
    await update(tree);

    expect(tree.exists('apps/product/webpack.config.js')).toBe(false);
  });
});
