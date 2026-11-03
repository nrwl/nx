import { describe, expect, it } from 'vitest';
import { LoadedNxPlugin } from './loaded-nx-plugin';

describe('LoadedNxPlugin', () => {
  it('reports its capabilities', () => {
    const plugin = new LoadedNxPlugin(
      {
        name: 'test-plugin',
        createNodes: ['**/project.json', async () => []],
        createDependencies: async () => [],
        createMetadata: async () => ({}),
        preTasksExecution: async () => {},
        postTasksExecution: async () => {},
      },
      'test-plugin'
    );

    expect(plugin.capabilities()).toEqual({
      createNodesPattern: '**/project.json',
      hasCreateDependencies: true,
      hasCreateMetadata: true,
      hasPreTasksExecution: true,
      hasPostTasksExecution: true,
    });
  });
});
