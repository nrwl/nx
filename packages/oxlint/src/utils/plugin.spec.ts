import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { hasOxlintPlugin } from './plugin';

describe('hasOxlintPlugin', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function addPlugin(plugin: string | { plugin: string }) {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [...(nxJson.plugins ?? []), plugin as any];
    updateNxJson(tree, nxJson);
  }

  it.each(['@nx/oxlint', '@nx/oxlint/plugin'])(
    'should recognise the %s string entry',
    (plugin) => {
      addPlugin(plugin);
      expect(hasOxlintPlugin(tree)).toBe(true);
    }
  );

  it.each(['@nx/oxlint', '@nx/oxlint/plugin'])(
    'should recognise the %s object entry',
    (plugin) => {
      addPlugin({ plugin });
      expect(hasOxlintPlugin(tree)).toBe(true);
    }
  );

  it('should not match an unrelated plugin', () => {
    addPlugin('@nx/eslint/plugin');
    expect(hasOxlintPlugin(tree)).toBe(false);
  });
});
