import { Tree, readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import removePackage from './remove-types-react-router-dom-package';

describe('update-16-3-0-remove-types-react-router-dom-package', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@types/react-router-dom'] = '*';
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
