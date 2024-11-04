import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-eas-pre-install';
import { addProjectConfiguration, Tree } from '@nx/devkit';

describe('Remove eas-build-pre-install script from app package.json', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
    });
  });

  it('should not throw an error if package.json does not exist', () => {
    expect(() => update(tree)).not.toThrow();
  });

  it('should not throw an error if there is no scripts in package.json', () => {
    tree.write('apps/product/package.json', JSON.stringify({}));
    expect(() => update(tree)).not.toThrow();
  });

  it('should remove eas-build-pre-install script', async () => {
    tree.write(
      'apps/product/package.json',
      JSON.stringify({
        scripts: {
          'eas-build-pre-install': 'echo "Hello World!"',
        },
      })
    );
    await update(tree);
    expect(tree.read('apps/product/package.json').toString()).not.toContain(
      'eas-build-pre-install'
    );
  });
});
