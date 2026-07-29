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

  it('should recognise the string entry', () => {
    addPlugin('@nx/oxlint');
    expect(hasOxlintPlugin(tree)).toBe(true);
  });

  it('should recognise the object entry', () => {
    addPlugin({ plugin: '@nx/oxlint' });
    expect(hasOxlintPlugin(tree)).toBe(true);
  });

  it('should not match an unrelated plugin', () => {
    addPlugin('@nx/eslint/plugin');
    expect(hasOxlintPlugin(tree)).toBe(false);
  });

  // The package exposes no `./plugin` subpath, so such an entry would fail to
  // resolve. Matching it would report a plugin that cannot load.
  it('should not match a @nx/oxlint subpath', () => {
    addPlugin('@nx/oxlint/plugin');
    expect(hasOxlintPlugin(tree)).toBe(false);
  });
});
