import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { readJson, readNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion, rolldownVersion } from '../../utils/versions';
import { rolldownInitGenerator } from './init';

describe('rolldownInitGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should install deps and register the plugin', async () => {
    await rolldownInitGenerator(tree, { addPlugin: true });

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      '@nx/rolldown': nxVersion,
      rolldown: rolldownVersion,
    });
    expect(readNxJson(tree).plugins).toContainEqual({
      plugin: '@nx/rolldown/plugin',
      options: { buildTargetName: 'build' },
    });
  });

  it('should keep an existing rolldown version', async () => {
    tree.write(
      'package.json',
      JSON.stringify({ devDependencies: { rolldown: '1.1.5' } })
    );

    await rolldownInitGenerator(tree, { addPlugin: true });

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
