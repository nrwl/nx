import '../internal-testing-utils/mock-fs';

import { vol } from 'memfs';

import { join } from 'path';
import {
  findCycle,
  makeAcyclic,
  validateNoAtomizedTasks,
} from './task-graph-utils';
import { tmpdir } from 'os';
import { workspaceRoot } from '../utils/workspace-root';
import { cacheDir } from '../utils/cache-directory';
import { Task } from '../config/task-graph';
import { ProjectGraph } from '../config/project-graph';

describe('task graph utils', () => {
  describe('findCycles', () => {
    it('should return a cycle if it is there', () => {
      expect(
        findCycle({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q', 'a'],
            q: [],
          },
        } as any)
      ).toEqual(['a', 'c', 'e', 'a']);
    });

    it('should return null when no cycle', () => {
      expect(
        findCycle({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q'],
            q: [],
          },
        } as any)
      ).toEqual(null);
    });
  });

  describe('makeAcyclic', () => {
    it('should remove cycles when they are there', () => {
      const graph = {
        roots: ['d'],
        dependencies: {
          a: ['b', 'c'],
          b: ['d'],
          c: ['e'],
          d: [],
          e: ['a'],
        },
      } as any;
      makeAcyclic(graph);

      expect(graph.dependencies).toEqual({
        a: ['b', 'c'],
        b: ['d'],
        c: ['e'],
        d: [],
        e: [],
      });
      expect(graph.roots).toEqual(['d', 'e']);
    });
  });

  describe('validateNoAtomizedTasks', () => {
    let mockProcessExit: jest.SpyInstance;
    let env: NodeJS.ProcessEnv;

    beforeEach(() => {
      env = process.env;
      process.env = {};

      mockProcessExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code: number) => {
          return undefined as any as never;
        });
    });

    afterEach(() => {
      process.env = env;
      vol.reset();
      mockProcessExit.mockRestore();
    });

    it('should do nothing if no tasks are atomized', () => {
      const taskGraph = {
        tasks: {
          'e2e:e2e': {
            id: 'e2e:e2e',
            target: {
              project: 'e2e',
              target: 'e2e',
            },
          },
        },
      };
      const projectGraph = {
        nodes: {
          e2e: {
            data: {
              targets: {
                e2e: {},
              },
            },
          },
        },
      };
      validateNoAtomizedTasks(taskGraph as any, projectGraph as any);
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should exit if atomized task is present', () => {
      const taskGraph = {
        tasks: {
          'e2e:e2e-ci': {
            id: 'e2e:e2e-ci',
            target: {
              project: 'e2e',
              target: 'e2e-ci',
            },
          },
        },
      };
      const projectGraph = {
        nodes: {
          e2e: {
            data: {
              targets: {
                'e2e-ci': {
                  metadata: {
                    nonAtomizedTarget: 'e2e',
                  },
                },
              },
            },
          },
        },
      };
      validateNoAtomizedTasks(taskGraph as any, projectGraph as any);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
    it('should exit if multiple atomized tasks are present', () => {
      const taskGraph = {
        tasks: {
          'e2e:e2e-ci': {
            id: 'e2e:e2e-ci',
            target: {
              project: 'e2e',
              target: 'e2e-ci',
            },
          },
          'gradle:test-ci': {
            id: 'gradle:test-ci',
            target: {
              project: 'gradle',
              target: 'test-ci',
            },
          },
        },
      };
      const projectGraph = {
        nodes: {
          e2e: {
            data: {
              targets: {
                'e2e-ci': {
                  metadata: {
                    nonAtomizedTarget: 'e2e',
                  },
                },
              },
            },
          },
          gradle: {
            data: {
              targets: {
                'test-ci': {
                  metadata: {
                    nonAtomizedTarget: 'test',
                  },
                },
              },
            },
          },
        },
      };
      validateNoAtomizedTasks(taskGraph as any, projectGraph as any);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
