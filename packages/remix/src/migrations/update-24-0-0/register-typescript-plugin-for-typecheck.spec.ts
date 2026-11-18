import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './register-typescript-plugin-for-typecheck';

describe('register-typescript-plugin-for-typecheck migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setPlugins(plugins: any[]) {
    const nxJson = readNxJson(tree);
    nxJson.plugins = plugins;
    updateNxJson(tree, nxJson);
  }

  it('should register @nx/js/typescript and remove typecheckTargetName', async () => {
    setPlugins([
      {
        plugin: '@nx/remix/plugin',
        options: { buildTargetName: 'build', typecheckTargetName: 'check' },
      },
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'check' } },
      },
      { plugin: '@nx/remix/plugin', options: { buildTargetName: 'build' } },
    ]);
  });

  it('should register @nx/js/typescript for a string registration', async () => {
    setPlugins(['@nx/remix/plugin']);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
      '@nx/remix/plugin',
    ]);
  });

  it('should remove typecheckTargetName: false without registering @nx/js/typescript', async () => {
    setPlugins([
      { plugin: '@nx/remix/plugin', options: { typecheckTargetName: false } },
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      { plugin: '@nx/remix/plugin', options: {} },
    ]);
  });

  it('should only remove typecheckTargetName when @nx/js/typescript is already registered', async () => {
    setPlugins([
      { plugin: '@nx/remix/plugin', options: { typecheckTargetName: 'check' } },
      '@nx/js/typescript',
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      { plugin: '@nx/remix/plugin', options: {} },
      '@nx/js/typescript',
    ]);
  });

  it('should not touch a workspace that already registers @nx/js/typescript', async () => {
    setPlugins(['@nx/remix/plugin', '@nx/js/typescript']);
    const before = tree.read('nx.json', 'utf-8');

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should be idempotent', async () => {
    setPlugins([
      { plugin: '@nx/remix/plugin', options: { typecheckTargetName: 'check' } },
    ]);

    await update(tree);
    const afterFirst = tree.read('nx.json', 'utf-8');
    expect(await update(tree)).toEqual({ skipAgentic: true });

    expect(tree.read('nx.json', 'utf-8')).toBe(afterFirst);
  });
});
