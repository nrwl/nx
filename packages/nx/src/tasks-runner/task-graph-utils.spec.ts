import '../internal-testing-utils/mock-fs';

import {
  assertTaskGraphDoesNotContainInvalidTargets,
  createMinimalTaskGraph,
  findCycle,
  findCycles,
  makeAcyclic,
  validateNoAtomizedTasks,
} from './task-graph-utils';
import { TaskGraph } from '../config/task-graph';

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
    let mockProcessExit: jest.SpyInstance;
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

  describe('createMinimalTaskGraph', () => {
    it('should return only the specified task when it has no dependencies', () => {
      const taskGraph: TaskGraph = {
        roots: ['a:build', 'b:build'],
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
          'b:build': {
            id: 'b:build',
            target: { project: 'b', target: 'build' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
        },
        dependencies: {
          'a:build': [],
          'b:build': [],
        },
        continuousDependencies: {
          'a:build': [],
          'b:build': [],
        },
      };

      const result = createMinimalTaskGraph(taskGraph, 'a:build');

      expect(Object.keys(result.tasks)).toEqual(['a:build']);
      expect(result.dependencies).toEqual({ 'a:build': [] });
      expect(result.continuousDependencies).toEqual({ 'a:build': [] });
      expect(result.roots).toEqual(['a:build']);
    });

    it('should include direct dependencies but not transitive ones', () => {
      const taskGraph: TaskGraph = {
        roots: ['c:build'],
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
          'b:build': {
            id: 'b:build',
            target: { project: 'b', target: 'build' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
          'c:build': {
            id: 'c:build',
            target: { project: 'c', target: 'build' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
        },
        dependencies: {
          'a:build': ['b:build'],
          'b:build': ['c:build'],
          'c:build': [],
        },
        continuousDependencies: {
          'a:build': [],
          'b:build': [],
          'c:build': [],
        },
      };

      const result = createMinimalTaskGraph(taskGraph, 'a:build');

      // Should include a:build and its direct dep b:build, but NOT c:build
      expect(Object.keys(result.tasks).sort()).toEqual(['a:build', 'b:build']);
      expect(result.dependencies['a:build']).toEqual(['b:build']);
      expect(result.dependencies['b:build']).toEqual([]);
      expect(result.roots).toEqual(['b:build']);
    });

    it('should include continuous dependencies', () => {
      const taskGraph: TaskGraph = {
        roots: ['a:build'],
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
          'b:serve': {
            id: 'b:serve',
            target: { project: 'b', target: 'serve' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
        },
        dependencies: {
          'a:build': [],
          'b:serve': [],
        },
        continuousDependencies: {
          'a:build': ['b:serve'],
          'b:serve': [],
        },
      };

      const result = createMinimalTaskGraph(taskGraph, 'a:build');

      expect(Object.keys(result.tasks).sort()).toEqual(['a:build', 'b:serve']);
      expect(result.continuousDependencies['a:build']).toEqual(['b:serve']);
      expect(result.continuousDependencies['b:serve']).toEqual([]);
    });

    it('should return an empty graph for a non-existent task', () => {
      const taskGraph: TaskGraph = {
        roots: ['a:build'],
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
        },
        dependencies: { 'a:build': [] },
        continuousDependencies: { 'a:build': [] },
      };

      const result = createMinimalTaskGraph(taskGraph, 'nonexistent:build');

      expect(result.tasks).toEqual({});
      expect(result.roots).toEqual([]);
      expect(result.dependencies).toEqual({});
      expect(result.continuousDependencies).toEqual({});
    });

    it('should dramatically reduce graph size for large task graphs', () => {
      // Simulate a large monorepo with many projects
      const tasks: Record<string, any> = {};
      const dependencies: Record<string, string[]> = {};
      const continuousDependencies: Record<string, string[]> = {};

      // Create 100 tasks where task-0 depends on task-1, task-1 depends on task-2, etc.
      for (let i = 0; i < 100; i++) {
        const id = `project-${i}:build`;
        tasks[id] = {
          id,
          target: { project: `project-${i}`, target: 'build' },
          overrides: {},
          outputs: [],
          parallelism: true,
        };
        dependencies[id] = i < 99 ? [`project-${i + 1}:build`] : [];
        continuousDependencies[id] = [];
      }

      const taskGraph: TaskGraph = {
        roots: ['project-99:build'],
        tasks,
        dependencies,
        continuousDependencies,
      };

      const result = createMinimalTaskGraph(taskGraph, 'project-0:build');

      // Should only contain 2 tasks (project-0 and its direct dep project-1), not all 100
      expect(Object.keys(result.tasks)).toHaveLength(2);
      expect(result.tasks['project-0:build']).toBeDefined();
      expect(result.tasks['project-1:build']).toBeDefined();
      expect(result.tasks['project-2:build']).toBeUndefined();
    });
  });

  describe('assertTaskGraphDoesNotContainInvalidTargets', () => {
    it('should throw if a task has parallelism set to false and has continuous dependencies', () => {
      const taskGraph: TaskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            parallelism: false,
            overrides: {},
            outputs: [],
          },
          'b:watch': {
            id: 'b:watch',
            target: { project: 'b', target: 'watch' },
            parallelism: false,
            overrides: {},
            outputs: [],
          },
        },
        continuousDependencies: {
          'a:build': ['b:watch'],
          'b:watch': [],
        },
        roots: ['a:build'],
        dependencies: {
          'a:build': [],
          'b:watch': [],
        },
      };
      expect(() => {
        assertTaskGraphDoesNotContainInvalidTargets(taskGraph);
      }).toThrowErrorMatchingInlineSnapshot(`
        "The following tasks do not support parallelism but depend on continuous tasks:
         - a:build -> b:watch"
      `);
    });

    it('should throw if a task that is depended on and is continuous has parallelism set to false', () => {
      const taskGraph: TaskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            overrides: {},
            outputs: [],
            parallelism: true,
          },
          'b:watch': {
            id: 'b:watch',
            target: { project: 'b', target: 'watch' },
            parallelism: false,
            overrides: {},
            outputs: [],
          },
        },
        continuousDependencies: { 'a:build': ['b:watch'], 'b:watch': [] },
        dependencies: { 'a:build': [], 'b:watch': [] },
        roots: ['a:build'],
      };
      expect(() => {
        assertTaskGraphDoesNotContainInvalidTargets(taskGraph);
      }).toThrowErrorMatchingInlineSnapshot(`
        "The following continuous tasks do not support parallelism but are depended on:
         - b:watch <- a:build
        Parallelism must be enabled for a continuous task if it is depended on, as the tasks that depend on it will run in parallel with it."
      `);
    });
  });
});
