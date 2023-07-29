import { Tree, readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import removePackage from './update-16-2-0-remove-package';

describe('update-16-2-0-remove-package', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['react-test-renderer'] = '18.2.0';
      return json;
    });
  });

  it('should remove react-test-renderer from package.json', async () => {
    await removePackage(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['react-test-renderer']
    ).not.toBeDefined();
  });
});
