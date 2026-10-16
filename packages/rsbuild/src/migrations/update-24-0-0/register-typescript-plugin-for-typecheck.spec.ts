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
        plugin: '@nx/rsbuild',
        options: { buildTargetName: 'build', typecheckTargetName: 'check' },
      },
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'check' } },
      },
      { plugin: '@nx/rsbuild', options: { buildTargetName: 'build' } },
    ]);
  });

  it('should register @nx/js/typescript with the default target name', async () => {
    setPlugins(['@nx/rsbuild']);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
      '@nx/rsbuild',
    ]);
  });

  it('should remove typecheckTargetName: false without registering @nx/js/typescript', async () => {
    setPlugins([
      {
        plugin: '@nx/rsbuild',
        options: { buildTargetName: 'build', typecheckTargetName: false },
      },
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      { plugin: '@nx/rsbuild', options: { buildTargetName: 'build' } },
    ]);
  });

  it('should only remove typecheckTargetName when @nx/js/typescript is already registered', async () => {
    setPlugins([
      { plugin: '@nx/rsbuild', options: { typecheckTargetName: 'check' } },
      '@nx/js/typescript',
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins).toEqual([
      { plugin: '@nx/rsbuild', options: {} },
      '@nx/js/typescript',
    ]);
  });

  it('should not touch a workspace that already registers @nx/js/typescript', async () => {
    setPlugins(['@nx/rsbuild', '@nx/js/typescript']);
    const before = tree.read('nx.json', 'utf-8');

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should not touch a workspace without @nx/rsbuild', async () => {
    setPlugins(['@nx/vite/plugin']);
    const before = tree.read('nx.json', 'utf-8');

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should be idempotent', async () => {
    setPlugins([
      { plugin: '@nx/rsbuild', options: { typecheckTargetName: 'check' } },
    ]);

    await update(tree);
    const afterFirst = tree.read('nx.json', 'utf-8');
    expect(await update(tree)).toEqual({ skipAgentic: true });

    expect(tree.read('nx.json', 'utf-8')).toBe(afterFirst);
  });
});
