import '../internal-testing-utils/mock-fs';

import {
  findCycle,
  findCycles,
  makeAcyclic,
  validateNoAtomizedTasks,
} from './task-graph-utils';

describe('task graph utils', () => {
  describe('findCycle', () => {
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
        })
      ).toEqual(['a', 'c', 'e', 'a']);

      expect(
        findCycle({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['a'],
            d: [],
            e: ['f'],
            f: ['q'],
            q: ['e'],
          },
        })
      ).toEqual(['a', 'c', 'a']);
    });

    it('should return a continuous cycle is there', () => {
      expect(
        findCycle({
          dependencies: {
            a: [],
            b: [],
            c: [],
            d: [],
            e: [],
            q: [],
          },
          continuousDependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q', 'a'],
            q: [],
          },
        })
      ).toEqual(['a', 'c', 'e', 'a']);

      expect(
        findCycle({
          dependencies: {
            a: ['b'],
            b: [],
            c: [],
            d: [],
            e: [],
            f: [],
            q: [],
          },
          continuousDependencies: {
            a: [],
            b: ['a'],
            c: [],
            d: [],
            e: [],
            f: [],
            q: [],
          },
        })
      ).toEqual(['a', 'b', 'a']);
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
        })
      ).toEqual(null);
    });
  });

  describe('findCycles', () => {
    it('should return all cycles', () => {
      expect(
        findCycles({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q', 'a'],
            q: [],
          },
        })
      ).toEqual(new Set(['a', 'c', 'e']));

      expect(
        findCycles({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['a'],
            d: [],
            e: ['f'],
            f: ['q'],
            q: ['e'],
          },
        })
      ).toEqual(new Set(['a', 'c', 'e', 'f', 'q']));
      expect(
        findCycles({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['f'],
            d: ['a'],
            e: [],
            f: ['q'],
            q: ['c'],
          },
        })
      ).toEqual(new Set(['a', 'b', 'd', 'c', 'f', 'q']));
    });

    it('should return null when no cycle', () => {
      expect(
        findCycles({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q'],
            q: [],
          },
        })
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
      };
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
    let mockProcessExit: jest.Spied<typeof process.exit>;
    let env: NodeJS.ProcessEnv;

    beforeEach(() => {
      env = process.env;
      process.env = {};

      mockProcessExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code: number) => {
          return undefined as never;
        });
    });

    afterEach(() => {
      process.env = env;
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
