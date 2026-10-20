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

  it('turns a string entry into an object entry with the option off', async () => {
    setPlugins(['@nx/vite/plugin', '@nx/playwright/plugin']);

    await update(tree);

    expect(readNxJson(tree).plugins).toEqual([
      '@nx/vite/plugin',
      {
        plugin: '@nx/playwright/plugin',
        options: { waitForServerReady: false },
      },
    ]);
  });

  it('adds the option to object entries and keeps include/exclude', async () => {
    setPlugins([
      {
        plugin: '@nx/playwright/plugin',
        options: { targetName: 'e2e' },
        include: ['apps/a-e2e/**'],
      },
      {
        plugin: '@nx/playwright/plugin',
        exclude: ['apps/a-e2e/**'],
      },
    ]);

    await update(tree);

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/playwright/plugin',
        options: { targetName: 'e2e', waitForServerReady: false },
        include: ['apps/a-e2e/**'],
      },
      {
        plugin: '@nx/playwright/plugin',
        options: { waitForServerReady: false },
        exclude: ['apps/a-e2e/**'],
      },
    ]);
  });

  it('keeps an entry that already sets the option', async () => {
    setPlugins([
      {
        plugin: '@nx/playwright/plugin',
        options: { waitForServerReady: true },
      },
    ]);
    const before = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(before);
    expect(result?.skipAgentic).toBe(true);
  });

  it('does not change nx.json without the playwright plugin', async () => {
    setPlugins(['@nx/vite/plugin', { plugin: '@nx/cypress/plugin' }]);
    const before = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(before);
    expect(result?.skipAgentic).toBe(true);
  });

  it('does nothing without nx.json', async () => {
    tree.delete('nx.json');

    const result = await update(tree);

    expect(tree.exists('nx.json')).toBe(false);
    expect(result?.skipAgentic).toBe(true);
  });

  it('is a no-op when run twice', async () => {
    setPlugins(['@nx/playwright/plugin']);
    await update(tree);
    const afterFirstRun = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toEqual(afterFirstRun);
    expect(result?.skipAgentic).toBe(true);
  });
});
