import {
  readNxJson,
  updateJson,
  updateNxJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './register-typescript-plugin-for-typecheck';

describe('register-typescript-plugin-for-typecheck migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['packages/*'];
      return json;
    });
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { composite: true },
    });
    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      files: [],
      references: [],
    });
  });

  function setPlugins(plugins: any[]) {
    const nxJson = readNxJson(tree);
    nxJson.plugins = plugins;
    updateNxJson(tree, nxJson);
  }

  it('should register @nx/js/typescript for the typecheck target', async () => {
    setPlugins([
      { plugin: '@nx/rsbuild', options: { typecheckTargetName: 'check' } },
    ]);

    expect(await update(tree)).toBeUndefined();

    expect(readNxJson(tree).plugins[1]).toEqual({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName: 'check' } },
    });
  });

  it('should not touch a workspace that already registers @nx/js/typescript', async () => {
    setPlugins(['@nx/rsbuild', '@nx/js/typescript']);
    const before = tree.read('nx.json', 'utf-8');

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should not touch a workspace without a TS solution setup', async () => {
    tree.delete('tsconfig.json');
    setPlugins(['@nx/rsbuild']);
    const before = tree.read('nx.json', 'utf-8');

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should be idempotent', async () => {
    setPlugins(['@nx/rsbuild']);

    await update(tree);
    const afterFirst = tree.read('nx.json', 'utf-8');
    expect(await update(tree)).toEqual({ skipAgentic: true });

    expect(tree.read('nx.json', 'utf-8')).toBe(afterFirst);
  });
});
