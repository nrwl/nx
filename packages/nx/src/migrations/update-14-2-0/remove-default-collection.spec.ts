import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import removeDefaultCollection from './remove-default-collection';
import {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '../../generators/utils/project-configuration';

describe('remove-default-collection', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should remove default collection from nx.json', async () => {
    const config = readWorkspaceConfiguration(tree);
    config.cli = {
      defaultCollection: 'default-collection',
      defaultProjectName: 'default-project',
    };
    updateWorkspaceConfiguration(tree, config);

    await removeDefaultCollection(tree);

    expect(readWorkspaceConfiguration(tree).cli).toEqual({
      defaultProjectName: 'default-project',
    });
  });

  it('should remove cli entirely if defaultCollection was the only setting', async () => {
    const config = readWorkspaceConfiguration(tree);
    config.cli = {
      defaultCollection: 'default-collection',
    };
    updateWorkspaceConfiguration(tree, config);

    await removeDefaultCollection(tree);

    expect(
      readWorkspaceConfiguration(tree).cli?.defaultCollection
    ).toBeUndefined();
  });

  it('should not error when "cli" is not defined', async () => {
    const config = readWorkspaceConfiguration(tree);
    delete config.cli;
    updateWorkspaceConfiguration(tree, config);

    await expect(removeDefaultCollection(tree)).resolves.not.toThrow();
  });
});
