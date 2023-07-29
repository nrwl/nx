import { assertRunsAgainstNxRepo } from 'nx/internal-testing-utils/run-migration-against-this-workspace';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from 'nx/src/generators/tree';
import { readJson, updateJson } from 'nx/src/generators/utils/json';
import replacePackage from './update-16-0-0-add-nx-packages';

describe('update-16-0-0-add-nx-packages', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@nrwl/devkit'] = '16.0.0';
      return json;
    });
  });

  it('should remove the dependency on @nrwl/devkit', async () => {
    await replacePackage(tree);

    expect(
      readJson(tree, 'package.json').dependencies['@nrwl/devkit']
    ).not.toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/devkit']
    ).not.toBeDefined();
  });

  it('should add a dependency on @nx/devkit', async () => {
    await replacePackage(tree);

    const packageJson = readJson(tree, 'package.json');
    const newDependencyVersion =
      packageJson.devDependencies['@nx/devkit'] ??
      packageJson.dependencies['@nx/devkit'];

    expect(newDependencyVersion).toBeDefined();
  });

  assertRunsAgainstNxRepo(replacePackage);
});
