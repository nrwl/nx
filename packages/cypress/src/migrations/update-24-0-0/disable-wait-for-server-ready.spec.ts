import { readNxJson, type Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './disable-wait-for-server-ready';

describe('disable-wait-for-server-ready migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setPlugins(plugins: any[]) {
    const nxJson = readNxJson(tree);
    nxJson.plugins = plugins;
    updateNxJson(tree, nxJson);
  }

  it('should expand a string entry and turn off waitForServerReady', async () => {
    setPlugins(['@nx/js/typescript', '@nx/cypress/plugin']);

    const result = await update(tree);

    expect(readNxJson(tree).plugins).toEqual([
      '@nx/js/typescript',
      {
        plugin: '@nx/cypress/plugin',
        options: { waitForServerReady: false },
      },
    ]);
    expect(result?.skipAgentic).toBeFalsy();
  });

  it('should add waitForServerReady to an object entry and keep its other settings', async () => {
    setPlugins([
      {
        plugin: '@nx/cypress/plugin',
        include: ['apps/a-e2e/**'],
        exclude: ['apps/b-e2e/**'],
        options: { targetName: 'e2e', ciTargetName: 'e2e-ci' },
      },
      {
        plugin: '@nx/cypress/plugin',
        include: ['apps/c-e2e/**'],
      },
    ]);

    await update(tree);

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/cypress/plugin',
        include: ['apps/a-e2e/**'],
        exclude: ['apps/b-e2e/**'],
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
          waitForServerReady: false,
        },
      },
      {
        plugin: '@nx/cypress/plugin',
        include: ['apps/c-e2e/**'],
        options: { waitForServerReady: false },
      },
    ]);
  });

  it('should keep waitForServerReady when it is already set', async () => {
    setPlugins([
      { plugin: '@nx/cypress/plugin', options: { waitForServerReady: true } },
    ]);
    const original = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(original);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should not change nx.json without the cypress plugin', async () => {
    setPlugins([
      '@nx/js/typescript',
      { plugin: '@nx/playwright/plugin', options: { targetName: 'e2e' } },
    ]);
    const original = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(original);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should not create nx.json when there is none', async () => {
    tree.delete('nx.json');

    const result = await update(tree);

    expect(tree.exists('nx.json')).toBe(false);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should be a no-op when run twice', async () => {
    setPlugins(['@nx/cypress/plugin']);
    await update(tree);
    const afterFirstRun = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(afterFirstRun);
    expect(result).toEqual({ skipAgentic: true });
  });
});
