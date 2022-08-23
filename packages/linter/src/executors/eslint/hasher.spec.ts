import type { Task, Hasher, Hash } from '@nrwl/devkit';

import run from './hasher';

describe('Eslint Hasher', () => {
  const mockHasher: Partial<Hasher> = {
    async hashTask(task: Task): Promise<Hash> {
      return {
        details: {
          command: 'test-command',
          nodes: {
            [`${task.target.project}:$filesets:${task.target.target}`]:
              'test-files-hash',
          },
          runtime: {},
          implicitDeps: {},
        },
        value: '',
      };
    },
    hashArray(values: string[]): string {
      return values.join('-');
    },
  };

  it('should fetch filesets from target', async () => {
    expect(
      await run(
        {
          target: { project: 'project', target: 'build' },
          id: 'test-proj',
          overrides: {},
        },
        {
          hasher: mockHasher as Hasher,
          projectGraph: {
            nodes: {
              project: {
                name: 'project',
                type: 'lib',
                data: {
                  root: 'libs/project',
                  targets: {
                    build: {
                      inputs: [
                        'default',
                        '^default',
                        { runtime: 'echo runtime123' },
                        { env: 'TESTENV' },
                        { env: 'NONEXISTENTENV' },
                      ],
                    },
                  },
                  files: [{ file: '/file', ext: '.ts', hash: 'file.hash' }],
                },
              },
            },
            dependencies: {
              project: [],
            },
            allWorkspaceFiles: [],
          },
          workspaceConfig: {
            projects: {},
            version: 2,
          },
        }
      )
    ).toEqual({
      details: {
        command: 'test-command',
        nodes: {
          project: 'test-files-hash',
          tags: '',
        },
      },
      value: 'test-command-test-files-hash-',
    });
  });
});
