import { LoadedNxPlugin } from './loaded-nx-plugin';

describe('LoadedNxPlugin', () => {
  const asPlugin = (module: Record<string, unknown>) =>
    new LoadedNxPlugin({ name: 'p', ...module } as any, 'p');

  it('reports a hook the module declared and left undefined', () => {
    // `export const createNodes = disabled ? undefined : createDotNetNodes`,
    // which is how a plugin turns itself off.
    const plugin = asPlugin({ createNodes: undefined });

    expect(plugin.hooksExportedAsUndefined).toEqual(['createNodes']);
  });

  it('reports nothing for a module that simply has no hooks', () => {
    // Indistinguishable from the case above by the time anything else looks,
    // because this class only takes on a hook it can call.
    const plugin = asPlugin({});

    expect(plugin.createNodes).toBeUndefined();
    expect(plugin.hooksExportedAsUndefined).toEqual([]);
  });

  it('reports nothing for a hook the module really exports', () => {
    const plugin = asPlugin({
      createNodes: ['**/*.json', async () => []],
      createDependencies: async () => [],
    });

    expect(plugin.hooksExportedAsUndefined).toEqual([]);
  });

  it('reports each of the exports a record is made of', () => {
    const plugin = asPlugin({
      createNodes: undefined,
      createNodesV2: undefined,
      createDependencies: undefined,
      createMetadata: undefined,
      preTasksExecution: undefined,
      postTasksExecution: undefined,
    });

    expect(plugin.hooksExportedAsUndefined).toEqual([
      'createNodes',
      'createNodesV2',
      'createDependencies',
      'createMetadata',
      'preTasksExecution',
      'postTasksExecution',
    ]);
  });
});
