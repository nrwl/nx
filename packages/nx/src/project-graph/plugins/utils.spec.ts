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
});
