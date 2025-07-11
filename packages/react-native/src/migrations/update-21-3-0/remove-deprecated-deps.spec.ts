import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-deprecated-deps';
import { addProjectConfiguration, Tree } from '@nx/devkit';

describe('Remove deprecated dependencies from root and app package.json', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
    });
  });

  it('should not throw an error if either package.json does not exist', () => {
    expect(() => update(tree)).not.toThrow();
  });

  it('should not throw an error if there is no dependencies in root or app package.json', () => {
    tree.write('package.json', JSON.stringify({}));
    tree.write('apps/product/package.json', JSON.stringify({}));
    expect(() => update(tree)).not.toThrow();
  });

  it('should remove deprecated dependencies', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@testing-library/jest-native': '~5.4.3',
          'jest-react-native': '18.0.0',
        },
      })
    );
    tree.write(
      'apps/product/package.json',
      JSON.stringify({
        dependencies: {
          '@testing-library/jest-native': '*',
          'jest-react-native': '*',
        },
      })
    );
    await update(tree);
    expect(tree.read('package.json').toString()).not.toContain(
      '@testing-library/jest-native'
    );
    expect(tree.read('package.json').toString()).not.toContain(
      'jest-react-native'
    );
    expect(tree.read('apps/product/package.json').toString()).not.toContain(
      '@testing-library/jest-native'
    );
    expect(tree.read('apps/product/package.json').toString()).not.toContain(
      'jest-react-native'
    );
  });
});
