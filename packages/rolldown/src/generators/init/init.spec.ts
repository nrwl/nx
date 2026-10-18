import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { readJson, readNxJson, type Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion, rolldownVersion } from '../../utils/versions';
import { rolldownInitGenerator } from './init';

describe('rolldownInitGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should install deps and register the plugin', async () => {
    await rolldownInitGenerator(tree, {});

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      '@nx/rolldown': nxVersion,
      rolldown: rolldownVersion,
    });
    expect(readNxJson(tree).plugins).toContainEqual({
      plugin: '@nx/rolldown/plugin',
      options: { buildTargetName: 'build' },
    });
    expect(readNxJson(tree).plugins).toContainEqual({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName: 'typecheck' } },
    });
  });

  it('should register @nx/js/typescript in a TS solution setup', async () => {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'ws', workspaces: ['packages/*'] })
    );
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { composite: true },
    });
    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      files: [],
      references: [],
    });

    await rolldownInitGenerator(tree, {});

    expect(
      readNxJson(tree).plugins.some(
        (p) => typeof p !== 'string' && p.plugin === '@nx/js/typescript'
      )
    ).toBe(true);
  });

  it('should keep an existing rolldown version', async () => {
    tree.write(
      'package.json',
      JSON.stringify({ devDependencies: { rolldown: '1.1.5' } })
    );

    await rolldownInitGenerator(tree, {});

    expect(readJson(tree, 'package.json').devDependencies.rolldown).toBe(
      '1.1.5'
    );
  });

  it('should reject rolldown below the supported floor', async () => {
    tree.write(
      'package.json',
      JSON.stringify({ devDependencies: { rolldown: '0.15.0' } })
    );

    await expect(rolldownInitGenerator(tree, {})).rejects.toThrow();
  });
});
