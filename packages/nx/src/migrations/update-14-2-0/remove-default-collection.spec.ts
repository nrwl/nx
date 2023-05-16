import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import {
  readNxJson,
  updateNxJson,
} from '../../generators/utils/project-configuration';
import { assertRunsAgainstNxRepo } from '../../../internal-testing-utils/run-migration-against-this-workspace';
import removeDefaultCollection from './remove-default-collection';

describe('remove-default-collection', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should remove default collection from nx.json', async () => {
    const config = readNxJson(tree);
    config.cli = {
      defaultCollection: 'default-collection',
      defaultProjectName: 'default-project',
    };
    updateNxJson(tree, config);

    await removeDefaultCollection(tree);

    expect(readNxJson(tree).cli).toEqual({
      defaultProjectName: 'default-project',
    });
  });

  it('should remove cli entirely if defaultCollection was the only setting', async () => {
    const config = readNxJson(tree);
    config.cli = {
      defaultCollection: 'default-collection',
    };
    updateNxJson(tree, config);

    await removeDefaultCollection(tree);

    expect(readNxJson(tree).cli?.defaultCollection).toBeUndefined();
  });

  it('should not error when "cli" is not defined', async () => {
    const config = readNxJson(tree);
    delete config.cli;
    updateNxJson(tree, config);

    await expect(removeDefaultCollection(tree)).resolves.not.toThrow();
  });

  it('should not error when nxJson does not exist', async () => {
    tree.delete('nx.json');
    await expect(removeDefaultCollection(tree)).resolves.not.toThrow();
  });

  assertRunsAgainstNxRepo(removeDefaultCollection);
});
