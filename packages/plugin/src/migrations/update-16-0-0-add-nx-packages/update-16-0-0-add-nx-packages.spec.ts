import { Tree, readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { assertRunsAgainstNxRepo } from '@nx/devkit/internal-testing-utils';
import replacePackage from './update-16-0-0-add-nx-packages';

describe('update-16-0-0-add-nx-packages', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@nrwl/nx-plugin'] = '16.0.0';
      return json;
    });
  });

  it('should remove the dependency on @nrwl/nx-plugin', async () => {
    await replacePackage(tree);

    expect(
      readJson(tree, 'package.json').dependencies['@nrwl/nx-plugin']
    ).not.toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/nx-plugin']
    ).not.toBeDefined();
  });

  it('should add a dependency on @nx/plugin', async () => {
    await replacePackage(tree);

    const packageJson = readJson(tree, 'package.json');
    const newDependencyVersion =
      packageJson.devDependencies['@nx/plugin'] ??
      packageJson.dependencies['@nx/plugin'];

    expect(newDependencyVersion).toBeDefined();
  });

  assertRunsAgainstNxRepo(replacePackage);
});
