import { Tree, readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import update from './update-nx-next-dependency';

describe('update-nx-next-dependency', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.dependencies['@nx/next'] = '16.0.0';
      return json;
    });
  });

  it('should move @nx/next from dependencies to devDependencies', async () => {
    await update(tree);

    expect(
      readJson(tree, 'package.json').dependencies['@nx/next']
    ).not.toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nx/next']
    ).toBeDefined();
  });
});
