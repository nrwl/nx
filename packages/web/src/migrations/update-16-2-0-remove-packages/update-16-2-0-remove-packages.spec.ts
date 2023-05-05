import { Tree, readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import removePackages from './update-16-2-0-remove-packages';

describe('update-16-2-0-remove-packages', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.dependencies['core-js'] = '3.6.5';
      json.dependencies['regenerator-runtime'] = '0.13.7';
      return json;
    });
  });

  it('should remove core-js & regenerator-runtime packages', async () => {
    await removePackages(tree);

    expect(
      readJson(tree, 'package.json').dependencies['core-js']
    ).not.toBeDefined();
    expect(
      readJson(tree, 'package.json').dependencies['regenerator-runtime']
    ).not.toBeDefined();
  });
});
