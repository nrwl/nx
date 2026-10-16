import { describe, expect, it } from 'vitest';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import update from './set-affected-granularity-to-project';

describe('set-affected-granularity-to-project', () => {
  function setup(nxJson: Record<string, unknown>): Tree {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'nx.json', nxJson);
    return tree;
  }

  it('sets project granularity when nx.json has no affected block', async () => {
    const tree = setup({ defaultBase: 'main' });

    const result = await update(tree);

    expect(readJson(tree, 'nx.json')).toEqual({
      defaultBase: 'main',
      affected: { granularity: 'project' },
    });
    expect(result).toEqual({ skipAgentic: true });
  });

  it('keeps existing affected options', async () => {
    const tree = setup({ affected: { defaultBase: 'develop' } });

    await update(tree);

    expect(readJson(tree, 'nx.json').affected).toEqual({
      defaultBase: 'develop',
      granularity: 'project',
    });
  });

  it('leaves an explicit granularity alone', async () => {
    const tree = setup({ affected: { granularity: 'task' } });
    const before = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toBe(before);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('is idempotent', async () => {
    const tree = setup({});

    await update(tree);
    const afterFirst = tree.read('nx.json', 'utf-8');
    await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toBe(afterFirst);
  });

  it('does nothing without an nx.json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.delete('nx.json');

    const result = await update(tree);

    expect(tree.exists('nx.json')).toBe(false);
    expect(result).toEqual({ skipAgentic: true });
  });
});
