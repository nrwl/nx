import { addLocalRegistryScripts } from './add-local-registry-scripts';
import { Tree, writeJson } from '@nx/devkit';
import { createTree } from '@nx/devkit/testing';

describe('addLocalRegistryScripts', () => {
  let tree: Tree;
  const startLocalRegistryPath = 'tools/scripts/start-local-registry.ts';
  const stopLocalRegistryPath = 'tools/scripts/stop-local-registry.ts';

  beforeEach(() => {
    tree = createTree();
    writeJson(tree, 'project.json', {
      name: 'mylib',
    });
  });

  it('should add "start-local-registry.ts" and "stop-local-registry.ts" in workspace\'s "tools/scripts" folder', () => {
    expect(addLocalRegistryScripts(tree)).toEqual({
      startLocalRegistryPath,
      stopLocalRegistryPath,
    });

    expect(tree.exists(startLocalRegistryPath)).toBe(true);
    expect(tree.exists(stopLocalRegistryPath)).toBe(true);
  });

  it('should set published version to "0.0.0-e2e"', () => {
    addLocalRegistryScripts(tree);

    const startLocalRegistry = tree.read(startLocalRegistryPath, 'utf-8');
    expect(/'0\.0\.0-e2e'/.test(startLocalRegistry)).toBe(true);
  });
});
