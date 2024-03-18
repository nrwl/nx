import { Tree, readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import replacePackage from './update-16-0-0-add-nx-packages';

describe('update-16-0-0-add-nx-packages', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@nrwl/react-native'] = '16.0.0';
      return json;
    });
  });

  it('should remove the dependency on @nrwl/react-native', async () => {
    await replacePackage(tree);

    expect(
      readJson(tree, 'package.json').dependencies['@nrwl/react-native']
    ).not.toBeDefined();
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/react-native']
    ).not.toBeDefined();
  });

  it('should add a dependency on @nx/react-native', async () => {
    await replacePackage(tree);

    const packageJson = readJson(tree, 'package.json');
    const newDependencyVersion =
      packageJson.devDependencies['@nx/react-native'] ??
      packageJson.dependencies['@nx/react-native'];

    expect(newDependencyVersion).toBeDefined();
  });
});
