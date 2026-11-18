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

  it('should register @nx/js/typescript and strip typecheckTargetName', async () => {
    setPlugins([
      {
        plugin: '@nx/react/router-plugin',
        options: { buildTargetName: 'build', typecheckTargetName: 'check' },
      },
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'check' } },
      },
      {
        plugin: '@nx/react/router-plugin',
        options: { buildTargetName: 'build' },
      },
    ]);
  });

  it('should register @nx/js/typescript for a string registration', async () => {
    setPlugins(['@nx/react/router-plugin']);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
      '@nx/react/router-plugin',
    ]);
  });

  it('should strip typecheckTargetName: false without registering @nx/js/typescript', async () => {
    setPlugins([
      {
        plugin: '@nx/react/router-plugin',
        options: { typecheckTargetName: false },
      },
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      { plugin: '@nx/react/router-plugin', options: {} },
    ]);
  });

  it('should only strip typecheckTargetName when @nx/js/typescript is already registered', async () => {
    setPlugins([
      {
        plugin: '@nx/react/router-plugin',
        options: { typecheckTargetName: 'typecheck' },
      },
      '@nx/js/typescript',
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      { plugin: '@nx/react/router-plugin', options: {} },
      '@nx/js/typescript',
    ]);
  });

  it('should not touch a workspace that already registers @nx/js/typescript', async () => {
    setPlugins(['@nx/react/router-plugin', '@nx/js/typescript']);
    const before = tree.read('nx.json', 'utf-8');

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should not touch a workspace without @nx/react/router-plugin', async () => {
    setPlugins(['@nx/vite/plugin']);
    const before = tree.read('nx.json', 'utf-8');

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should be idempotent', async () => {
    setPlugins([
      {
        plugin: '@nx/react/router-plugin',
        options: { typecheckTargetName: 'typecheck' },
      },
    ]);

    await update(tree);
    const afterFirst = tree.read('nx.json', 'utf-8');
    expect(await update(tree)).toEqual({ skipAgentic: true });

    expect(tree.read('nx.json', 'utf-8')).toBe(afterFirst);
  });
});
