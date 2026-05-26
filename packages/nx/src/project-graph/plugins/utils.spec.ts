import { isAggregateCreateNodesError } from '../error-types';
import { createNodesFromFiles } from './utils';

const configFiles = ['file1', 'file2'] as const;

const context = {
  nxJsonConfiguration: {},
  workspaceRoot: '',
} as const;

describe('createNodesFromFiles', () => {
  it('should return results with context', async () => {
    const createNodes = [
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
    ] as const;
    const options = {};

    const results = await createNodesFromFiles(
      createNodes[1],
      configFiles,
      options,
      context
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "file1",
          {
            "projects": {
              "file1": {
                "root": "file1",
              },
            },
          },
        ],
        [
          "file2",
          {
            "projects": {
              "file2": {
                "root": "file2",
              },
            },
          },
        ],
      ]
    `);
  });

  it('should handle async errors', async () => {
    const createNodes = [
      '*/**/*',
      async () => {
        throw new Error('Async Error');
      },
    ] as const;
    const options = {};

    let error;
    await createNodesFromFiles(
      createNodes[1],
      configFiles,
      options,
      context
    ).catch((e) => (error = e));

    const isAggregateError = isAggregateCreateNodesError(error);
    expect(isAggregateError).toBe(true);

    if (isAggregateCreateNodesError(error)) {
      expect(error.errors).toMatchInlineSnapshot(`
        [
          [
            "file1",
            [Error: Async Error],
          ],
          [
            "file2",
            [Error: Async Error],
          ],
        ]
      `);
    }
  });

  it('should handle sync errors', async () => {
    const createNodes = [
      '*/**/*',
      () => {
        throw new Error('Sync Error');
      },
    ] as const;
    const options = {};

    let error;
    await createNodesFromFiles(
      createNodes[1],
      configFiles,
      options,
      context
    ).catch((e) => (error = e));

    const isAggregateError = isAggregateCreateNodesError(error);
    expect(isAggregateError).toBe(true);

    if (isAggregateCreateNodesError(error)) {
      expect(error.errors).toMatchInlineSnapshot(`
        [
          [
            "file1",
            [Error: Sync Error],
          ],
          [
            "file2",
            [Error: Sync Error],
          ],
        ]
      `);
    }
  });

  it('should handle partial errors', async () => {
    const createNodes = [
      '*/**/*',
      async (file: string) => {
        if (file === 'file1') {
          throw new Error('Error');
        }
        return {
          projects: {
            [file]: {
              root: file,
            },
          },
        };
      },
    ] as const;
    const options = {};

    let error;
    await createNodesFromFiles(
      createNodes[1],
      configFiles,
      options,
      context
    ).catch((e) => (error = e));

    const isAggregateError = isAggregateCreateNodesError(error);
    expect(isAggregateError).toBe(true);

    if (isAggregateCreateNodesError(error)) {
      expect(error.errors).toMatchInlineSnapshot(`
        [
          [
            "file1",
            [Error: Error],
          ],
        ]
      `);
      expect(error.partialResults).toMatchInlineSnapshot(`
        [
          [
            "file2",
            {
              "projects": {
                "file2": {
                  "root": "file2",
                },
              },
            },
          ],
        ]
      `);
    }
  });

  it('should preserve input order when callbacks resolve out of order', async () => {
    // Resolve later configFiles first to prove that ordering follows
    // the input array, not the order in which promises settle.
    const orderedConfigFiles = ['file1', 'file2', 'file3'] as const;
    const delays: Record<string, number> = {
      file1: 30,
      file2: 0,
      file3: 15,
    };

    const createNodes = [
      '*/**/*',
      async (file: string) => {
        await new Promise((resolve) => setTimeout(resolve, delays[file]));
        return {
          projects: {
            [file]: {
              root: file,
            },
          },
        };
      },
    ] as const;

    const results = await createNodesFromFiles(
      createNodes[1],
      orderedConfigFiles,
      {},
      context
    );

    expect(results.map(([file]) => file)).toEqual(['file1', 'file2', 'file3']);
  });

  it('should preserve input order for partial errors when callbacks resolve out of order', async () => {
    const orderedConfigFiles = ['file1', 'file2', 'file3', 'file4'] as const;
    const delays: Record<string, number> = {
      file1: 25,
      file2: 0,
      file3: 10,
      file4: 5,
    };

    const createNodes = [
      '*/**/*',
      async (file: string) => {
        await new Promise((resolve) => setTimeout(resolve, delays[file]));
        if (file === 'file1' || file === 'file3') {
          throw new Error(`Error ${file}`);
        }
        return {
          projects: {
            [file]: {
              root: file,
            },
          },
        };
      },
    ] as const;

    let error;
    await createNodesFromFiles(
      createNodes[1],
      orderedConfigFiles,
      {},
      context
    ).catch((e) => (error = e));

    expect(isAggregateCreateNodesError(error)).toBe(true);
    if (isAggregateCreateNodesError(error)) {
      expect(error.errors.map(([file]) => file)).toEqual(['file1', 'file3']);
      expect(error.partialResults.map(([file]) => file)).toEqual([
        'file2',
        'file4',
      ]);
    }
  });

  it('should filter out null results', async () => {
    const createNodes = [
      '**/*',
      () => {
        return null;
      },
    ] as const;
    const options = {};

    expect(
      await createNodesFromFiles(createNodes[1], configFiles, options, context)
    ).toEqual([]);
  });
});
