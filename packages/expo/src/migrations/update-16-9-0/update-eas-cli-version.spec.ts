import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './update-eas-cli-version';

describe('update-eas-cli-version', () => {
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
    tree.write('apps/product/eas.json', '{"cli":{"version": "1.2.3"}}');
  });

  it(`should update eas.json with greater than version`, async () => {
    await update(tree);

    const easJson = JSON.parse(tree.read('apps/product/eas.json').toString());
    expect(easJson.cli.version).toContain('>=');
  });
});
