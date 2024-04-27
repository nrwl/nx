import { runCreateNodesInParallel } from './utils';

const configFiles = ['file1', 'file2'] as const;

const context = {
  file: 'file1',
  nxJsonConfiguration: {},
  workspaceRoot: '',
  configFiles,
} as const;

describe('createNodesInParallel', () => {
  it('should return results with context', async () => {
    const plugin = {
      name: 'test',
      createNodes: [
        '*/**/*',
        async (file: string) => {
          return {
            projects: {
              [file]: {
                root: file,
              },
            },
          };
        },
      ],
    } as const;
    const options = {};

    const results = await runCreateNodesInParallel(
      configFiles,
      plugin,
      options,
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "file": "file1",
          "pluginName": "test",
          "projects": {
            "file1": {
              "root": "file1",
            },
          },
        },
        {
          "file": "file2",
          "pluginName": "test",
          "projects": {
            "file2": {
              "root": "file2",
            },
          },
        },
      ]
    `);
  });

  it('should handle async errors', async () => {
    const plugin = {
      name: 'test',
      createNodes: [
        '*/**/*',
        async () => {
          throw new Error('Async Error');
        },
      ],
    } as const;
    const options = {};

    const error = await runCreateNodesInParallel(
      configFiles,
      plugin,
      options,
      context
    ).catch((e) => e);

    expect(error).toMatchInlineSnapshot(
      `[AggregateCreateNodesError: Failed to create nodes]`
    );

    expect(error.errors).toMatchInlineSnapshot(`
      [
        [CreateNodesError: The "test" plugin threw an error while creating nodes from file1:],
        [CreateNodesError: The "test" plugin threw an error while creating nodes from file2:],
      ]
    `);
  });

  it('should handle sync errors', async () => {
    const plugin = {
      name: 'test',
      createNodes: [
        '*/**/*',
        () => {
          throw new Error('Sync Error');
        },
      ],
    } as const;
    const options = {};

    const error = await runCreateNodesInParallel(
      configFiles,
      plugin,
      options,
      context
    ).catch((e) => e);

    expect(error).toMatchInlineSnapshot(
      `[AggregateCreateNodesError: Failed to create nodes]`
    );

    expect(error.errors).toMatchInlineSnapshot(`
      [
        [CreateNodesError: The "test" plugin threw an error while creating nodes from file1:],
        [CreateNodesError: The "test" plugin threw an error while creating nodes from file2:],
      ]
    `);
  });
});
