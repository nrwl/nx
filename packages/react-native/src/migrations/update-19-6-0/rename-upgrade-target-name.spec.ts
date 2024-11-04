import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './rename-upgrade-target-name';

describe('rename-upgrade-target-name', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should skip if no plugins', async () => {
    expect(update(tree)).resolves.not.toThrow();
  });

  it('should fix upgrade target name option', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/react-native/plugin',
        options: {
          upgradeTargetname: 'upgrade',
          buildIosTargetName: 'build-ios',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    await update(tree);

    const updatedNxJson = readNxJson(tree);

    expect(updatedNxJson.plugins).toEqual([
      {
        plugin: '@nx/react-native/plugin',
        options: {
          upgradeTargetName: 'upgrade',
          buildIosTargetName: 'build-ios',
        },
      },
    ]);
  });
});
