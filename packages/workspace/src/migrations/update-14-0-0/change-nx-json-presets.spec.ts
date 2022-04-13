import {
  readJson,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import changeNxJsonPresets from '@nrwl/workspace/src/migrations/update-14-0-0/change-nx-json-presets';

describe('changeNxJsonPresets', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not set any new extends', async () => {
    await changeNxJsonPresets(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.extends).toBeUndefined();
  });

  it('should change @nrwl/workspace/presets/npm.json', async () => {
    updateWorkspaceConfiguration(tree, {
      ...readWorkspaceConfiguration(tree),
      extends: '@nrwl/workspace/presets/npm.json',
    });

    await changeNxJsonPresets(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.extends).toEqual('nx/presets/npm.json');
  });

  it('should change @nrwl/workspace/presets/core.json', async () => {
    updateWorkspaceConfiguration(tree, {
      ...readWorkspaceConfiguration(tree),
      extends: '@nrwl/workspace/presets/core.json',
    });

    await changeNxJsonPresets(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.extends).toEqual('nx/presets/core.json');
  });
});
