import { readJson, writeJson } from '../../generators/utils/json';
import { createTree } from '../../generators/testing-utils/create-tree';
import removeProjectNameAndRootFormat from './remove-project-name-and-root-format';
import { NxJsonConfiguration } from '../../config/nx-json';

describe('removeProjectNameAndRootFormat', () => {
  let tree;
  beforeEach(() => {
    tree = createTree();
  });

  it('should not error if nx.json is not present', async () => {
    await removeProjectNameAndRootFormat(tree);
  });

  it('should not update nx.json if projectNameAndRoot is not present', async () => {
    const nxJson: NxJsonConfiguration = {};
    writeJson(tree, 'nx.json', nxJson);
    await removeProjectNameAndRootFormat(tree);
    expect(readJson(tree, 'nx.json')).toEqual(nxJson);
  });

  it('should remove projectNameAndRoot if it is present', async () => {
    const nxJson: any = {
      workspaceLayout: {
        libsDir: 'libs',
      },
    };
    writeJson(tree, 'nx.json', nxJson);
    await removeProjectNameAndRootFormat(tree);
    expect(readJson(tree, 'nx.json').workspaceLayout).toEqual({
      libsDir: 'libs',
    });
  });

  it('should remove workspaceLayout if it is present', async () => {
    const nxJson: any = {
      workspaceLayout: {},
    };
    writeJson(tree, 'nx.json', nxJson);
    await removeProjectNameAndRootFormat(tree);
    expect(readJson(tree, 'nx.json').workspaceLayout).not.toBeDefined();
  });
});
