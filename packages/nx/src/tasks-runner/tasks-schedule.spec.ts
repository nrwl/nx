import { TasksSchedule } from './tasks-schedule';
import { removeTasksFromTaskGraph } from './utils';
import { Task, TaskGraph } from '../config/task-graph';
import { DependencyType, ProjectGraph } from '../config/project-graph';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import * as nxJsonUtils from '../config/nx-json';
import * as executorUtils from '../command-line/run/executor-utils';
import * as taskHistoryUtils from '../utils/task-history';
import type { LifeCycle } from './life-cycle';
import { TaskReadiness } from '../native';

function createMockTask(
  id: string,
  parallelism: boolean = true,
  continuous: boolean = false
): Task {
  const [project, target] = id.split(':');
  return {
    id,
    target: {
      project,
      target,
    },
    outputs: [],
    overrides: {},
    parallelism,
    continuous,
  };
}

describe('TasksSchedule', () => {
  let taskHistory: any;
  let lifeCycle: LifeCycle;

  beforeEach(() => {
    lifeCycle = {
      startTask: vi.fn(),
      endTask: vi.fn(),
      scheduleTask: vi.fn(),
    };
    taskHistory = {
      getEstimatedTaskTimings: vi.fn(),
      getFlakyTasks: vi.fn(),
      recordTaskRuns: vi.fn(),
    };
    vi.spyOn(taskHistoryUtils, 'getTaskHistory').mockReturnValue(taskHistory);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('dependent tasks', () => {
    let taskSchedule: TasksSchedule;
    let taskGraph: TaskGraph;
    let app1Build: Task;
    let app2Build: Task;
    let lib1Build: Task;
    beforeEach(async () => {
      app1Build = createMockTask('app1:build');
      app2Build = createMockTask('app2:build');
      lib1Build = createMockTask('lib1:build');

      taskGraph = {
        tasks: {
          'app1:build': app1Build,
          'app2:build': app2Build,
          'lib1:build': lib1Build,
        },
        dependencies: {
          'app1:build': ['lib1:build'],
          'app2:build': [],
          'lib1:build': [],
        },
        continuousDependencies: {
          'app1:build': [],
          'app2:build': [],
          'lib1:build': [],
        },
        roots: ['lib1:build', 'app2:build'],
      };
      vi.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        isNgCompat: true,
        isNxExecutor: true,
      });

      const projectGraph: ProjectGraph = {
        nodes: {
          app1: {
            data: {
              root: 'app1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
            name: 'app1',
            type: 'app',
          },
          app2: {
            name: 'app2',
            type: 'app',
            data: {
              root: 'app2',
              targets: {
                build: {
                  executor: 'awesome-executors:app2-build',
                },
              },
            },
          },
          lib1: {
            name: 'lib1',
            type: 'lib',
            data: {
              root: 'lib1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
          },
        } as any,
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'lib1',
              type: DependencyType.static,
            },
          ],
          app2: [
            {
              source: 'app2',
              target: 'lib1',
              type: DependencyType.static,
            },
          ],
        },
        externalNodes: {},
        version: '5',
      };
      taskHistory.getEstimatedTaskTimings.mockReturnValue({});
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          lifeCycle,
        }
      );
      await taskSchedule.init();
    });

    describe('Without Batch Mode', () => {
      let original;
      beforeEach(() => {
        original = process.env['NX_BATCH_MODE'];
        process.env['NX_BATCH_MODE'] = 'false';
      });

      afterEach(() => {
        process.env['NX_BATCH_MODE'] = original;
      });

      it('should begin with no scheduled tasks', () => {
        expect(taskSchedule.nextBatch()).toBeNull();
        expect(taskSchedule.nextTask()).toBeNull();
      });

      it('should schedule root tasks first', async () => {
        await taskSchedule.scheduleNextTasks();
        expect(taskSchedule.nextTask()).toEqual(lib1Build);
        expect(taskSchedule.nextTask()).toEqual(app2Build);
      });

      it('should not schedule any tasks that still have uncompleted dependencies', async () => {
        await taskSchedule.scheduleNextTasks();
        taskSchedule.nextTask();
        taskSchedule.nextTask();
        expect(taskSchedule.nextTask()).toBeNull();

        taskSchedule.complete([app2Build.id]);

        expect(taskSchedule.nextTask()).toBeNull();
      });

      it('should continue to schedule tasks that have completed dependencies', async () => {
        await taskSchedule.scheduleNextTasks();
        taskSchedule.nextTask();
        taskSchedule.nextTask();
        taskSchedule.complete([lib1Build.id]);

        await taskSchedule.scheduleNextTasks();
        expect(taskSchedule.nextTask()).toEqual(app1Build);
      });

      it('should run out of tasks when they are all complete', async () => {
        await taskSchedule.scheduleNextTasks();
        taskSchedule.nextTask();
        taskSchedule.nextTask();
        taskSchedule.complete([lib1Build.id, app1Build.id, app2Build.id]);

        expect(taskSchedule.hasTasks()).toEqual(false);
      });

      it('should not schedule batches', async () => {
        await taskSchedule.scheduleNextTasks();

        expect(taskSchedule.nextTask()).not.toBeNull();

        expect(taskSchedule.nextBatch()).toBeNull();
      });
    });

    describe('With Batch Mode', () => {
      let original;
      beforeEach(() => {
        original = process.env['NX_BATCH_MODE'];
        process.env['NX_BATCH_MODE'] = 'true';
      });

      afterEach(() => {
        process.env['NX_BATCH_MODE'] = original;
      });

      it('should schedule batches of tasks by different executors', async () => {
        await taskSchedule.scheduleNextTasks();

        expect(taskSchedule.nextTask()).toBeNull();

        expect(taskSchedule.nextBatch()).toEqual({
          executorName: 'awesome-executors:build',
          id: 'awesome-executors:build 1',
          taskGraph: removeTasksFromTaskGraph(taskGraph, ['app2:build']),
        });
        expect(taskSchedule.nextBatch()).toEqual({
          executorName: 'awesome-executors:app2-build',
          id: 'awesome-executors:app2-build 1',
          taskGraph: removeTasksFromTaskGraph(taskGraph, [
            'app1:build',
            'lib1:build',
          ]),
        });
      });

      it('should run out of tasks when all batches are done', async () => {
        await taskSchedule.scheduleNextTasks();
        taskSchedule.nextBatch();
        taskSchedule.nextBatch();
        taskSchedule.complete(['app1:build', 'lib1:build', 'app2:build']);
        expect(taskSchedule.hasTasks()).toEqual(false);
      });
    });
  });

  describe('non-dependent tasks', () => {
    let taskSchedule: TasksSchedule;
    let taskGraph: TaskGraph;
    let app1Test: Task;
    let app2Test: Task;
    let app3Test: Task;
    let app4Test: Task;
    let lib1Test: Task;
    beforeEach(async () => {
      app1Test = createMockTask('app1:test');
      app2Test = createMockTask('app2:test');
      app3Test = createMockTask('app3:test');
      app4Test = createMockTask('app4:test');
      lib1Test = createMockTask('lib1:test');

      taskGraph = {
        tasks: {
          'app1:test': app1Test,
          'app2:test': app2Test,
          'app3:test': app3Test,
          'app4:test': app4Test,
          'lib1:test': lib1Test,
        },
        dependencies: {
          'app1:test': [],
          'app2:test': [],
          'app3:test': [],
          'app4:test': [],
          'lib1:test': [],
        },
        continuousDependencies: {
          'app1:test': [],
          'app2:test': [],
          'app3:test': [],
          'app4:test': [],
          'lib1:test': [],
        },
        roots: [
          'app1:test',
          'app2:test',
          'lib1:test',
          'app3:test',
          'app4:test',
        ],
      };
      vi.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        isNgCompat: true,
        isNxExecutor: true,
      });

      const projectGraph: ProjectGraph = {
        nodes: {
          app1: {
            data: {
              root: 'app1',
              targets: {
                test: {
                  executor: 'awesome-executors:test',
                },
              },
            },
            name: 'app1',
            type: 'app',
          },
          app2: {
            name: 'app2',
            type: 'app',
            data: {
              root: 'app2',
              targets: {
                test: {
                  executor: 'awesome-executors:app2-test',
                },
              },
            },
          },
          app3: {
            name: 'app3',
            type: 'app',
            data: {
              root: 'app3',
              targets: {
                test: {
                  executor: 'awesome-executors:app2-test',
                },
              },
            },
          },
          app4: {
            name: 'app4',
            type: 'app',
            data: {
              root: 'app4',
              targets: {
                test: {
                  executor: 'awesome-executors:app2-test',
                },
              },
            },
          },
          lib1: {
            name: 'lib1',
            type: 'lib',
            data: {
              root: 'lib1',
              targets: {
                test: {
                  executor: 'awesome-executors:test',
                },
              },
            },
          },
        } as any,
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'lib1',
              type: DependencyType.static,
            },
          ],
          app2: [
            {
              source: 'app2',
              target: 'lib1',
              type: DependencyType.static,
            },
          ],
        },
        externalNodes: {},
        version: '5',
      };
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          lifeCycle,
        }
      );
    });

    describe('Without Batch Mode', () => {
      let original;
      beforeEach(() => {
        original = process.env['NX_BATCH_MODE'];
        process.env['NX_BATCH_MODE'] = 'false';
      });

      afterEach(() => {
        process.env['NX_BATCH_MODE'] = original;
      });

      describe('when all tasks have same historical runtime', () => {
        beforeEach(async () => {
          taskHistory.getEstimatedTaskTimings.mockReturnValue({
            'app1:test': 100,
            'app2:test': 100,
            'app3:test': 100,
            'app4:test': 100,
            'lib1:test': 100,
          });
          await taskSchedule.init();
        });

        it('should begin with no scheduled tasks', () => {
          expect(taskSchedule.nextBatch()).toBeNull();
          expect(taskSchedule.nextTask()).toBeNull();
        });

        it('should schedule root tasks in topological order', async () => {
          await taskSchedule.scheduleNextTasks();
          expect(taskSchedule.nextTask()).toEqual(lib1Test);
          expect(taskSchedule.nextTask()).toEqual(app1Test);
          expect(taskSchedule.nextTask()).toEqual(app2Test);
          expect(taskSchedule.nextTask()).toEqual(app3Test);
          expect(taskSchedule.nextTask()).toEqual(app4Test);
        });

        it('should run out of tasks when they are all complete', async () => {
          await taskSchedule.scheduleNextTasks();
          taskSchedule.nextTask();
          taskSchedule.nextTask();
          taskSchedule.nextTask();
          taskSchedule.nextTask();
          taskSchedule.nextTask();
          taskSchedule.complete([
            lib1Test.id,
            app1Test.id,
            app2Test.id,
            app3Test.id,
            app4Test.id,
          ]);

          expect(taskSchedule.hasTasks()).toEqual(false);
        });

        it('should not schedule batches', async () => {
          await taskSchedule.scheduleNextTasks();

          expect(taskSchedule.nextTask()).not.toBeNull();

          expect(taskSchedule.nextBatch()).toBeNull();
        });
      });

      describe('when all tasks have different historical runtime', () => {
        it('should schedule task with longer runtime first', async () => {
          taskHistory.getEstimatedTaskTimings.mockReturnValue({
            'app1:test': 200,
            'app2:test': 300,
            'app3:test': 400,
            'app4:test': 500,
            'lib1:test': 100,
          });
          await taskSchedule.init();

          await taskSchedule.scheduleNextTasks();
          expect(taskSchedule.nextTask()).toEqual(lib1Test); // lib1 should run first because app1 and app2 depend on it
          expect(taskSchedule.nextTask()).toEqual(app4Test); // app4 should run first because it has the longest runtime
          expect(taskSchedule.nextTask()).toEqual(app3Test);
          expect(taskSchedule.nextTask()).toEqual(app2Test);
          expect(taskSchedule.nextTask()).toEqual(app1Test);
        });

        it('should schedule task with no historial runtime first', async () => {
          taskHistory.getEstimatedTaskTimings.mockReturnValue({
            'app1:test': 200,
            'app4:test': 500,
            'lib1:test': 100,
          });
          await taskSchedule.init();

          await taskSchedule.scheduleNextTasks();
          expect(taskSchedule.nextTask()).toEqual(lib1Test); // lib1 should run first because app1 and app2 depend on it
          expect(taskSchedule.nextTask()).toEqual(app2Test); // app2 should run because it has no historical runtime
          expect(taskSchedule.nextTask()).toEqual(app3Test); // app3 should run because it has no historical runtime
          expect(taskSchedule.nextTask()).toEqual(app4Test); // app4 should run because it has the longest runtime
          expect(taskSchedule.nextTask()).toEqual(app1Test); // app1 should run last because it has the shortest runtime
        });
      });
    });

    describe('With Batch Mode', () => {
      let original;
      beforeEach(() => {
        original = process.env['NX_BATCH_MODE'];
        process.env['NX_BATCH_MODE'] = 'true';
      });

      afterEach(() => {
        process.env['NX_BATCH_MODE'] = original;
      });

      it('should schedule batches of tasks by different executors', async () => {
        await taskSchedule.scheduleNextTasks();

        expect(taskSchedule.nextTask()).toBeNull();

        expect(taskSchedule.nextBatch()).toEqual({
          executorName: 'awesome-executors:test',
          id: 'awesome-executors:test 1',
          taskGraph: removeTasksFromTaskGraph(taskGraph, [
            'app2:test',
            'app3:test',
            'app4:test',
          ]),
        });
        expect(taskSchedule.nextBatch()).toEqual({
          executorName: 'awesome-executors:app2-test',
          id: 'awesome-executors:app2-test 1',
          taskGraph: removeTasksFromTaskGraph(taskGraph, [
            'app1:test',
            'lib1:test',
          ]),
        });
      });

      it('should run out of tasks when all batches are done', async () => {
        await taskSchedule.scheduleNextTasks();
        taskSchedule.nextBatch();
        taskSchedule.nextBatch();
        taskSchedule.complete(['app1:test', 'lib1:test', 'app2:test']);
        expect(taskSchedule.hasTasks()).toEqual(false);
      });
    });
  });

  describe('tasks with parallelism false', () => {
    describe('dependent tasks', () => {
      let taskSchedule: TasksSchedule;
      let taskGraph: TaskGraph;
      let app1Build: Task;
      let app2Build: Task;
      let lib1Build: Task;
      beforeEach(async () => {
        // app1 depends on lib1
        // app2 does not depend on anything
        // lib1 does not depend on anything
        // all tasks have parallelism set to false
        app1Build = createMockTask('app1:build', false);
        app2Build = createMockTask('app2:build', false);
        lib1Build = createMockTask('lib1:build', false);

        taskGraph = {
          tasks: {
            'app1:build': app1Build,
            'app2:build': app2Build,
            'lib1:build': lib1Build,
          },
          dependencies: {
            'app1:build': ['lib1:build'],
            'app2:build': [],
            'lib1:build': [],
          },
          continuousDependencies: {
            'app1:build': [],
            'app2:build': [],
            'lib1:build': [],
          },
          roots: ['lib1:build', 'app2:build'],
        };
        vi.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
        vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
          schema: {
            version: 2,
            properties: {},
          },
          implementationFactory: vi.fn(),
          batchImplementationFactory: vi.fn(),
          isNgCompat: true,
          isNxExecutor: true,
        });

        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              data: {
                root: 'app1',
                targets: {
                  build: {
                    executor: 'awesome-executors:build',
                  },
                },
              },
              name: 'app1',
              type: 'app',
            },
            app2: {
              name: 'app2',
              type: 'app',
              data: {
                root: 'app2',
                targets: {
                  build: {
                    executor: 'awesome-executors:app2-build',
                  },
                },
              },
            },
            lib1: {
              name: 'lib1',
              type: 'lib',
              data: {
                root: 'lib1',
                targets: {
                  build: {
                    executor: 'awesome-executors:build',
                  },
                },
              },
            },
          } as any,
          dependencies: {
            app1: [
              {
                source: 'app1',
                target: 'lib1',
                type: DependencyType.static,
              },
            ],
            app2: [
              {
                source: 'app2',
                target: 'lib1',
                type: DependencyType.static,
              },
            ],
          },
          externalNodes: {},
          version: '5',
        };
        taskHistory.getEstimatedTaskTimings.mockReturnValue({});
        taskSchedule = new TasksSchedule(
          projectGraph,
          readProjectsConfigurationFromProjectGraph(projectGraph).projects,
          taskGraph,
          {
            lifeCycle,
          }
        );
        await taskSchedule.init();
      });

      describe('Without Batch Mode', () => {
        let original;
        beforeEach(() => {
          original = process.env['NX_BATCH_MODE'];
          process.env['NX_BATCH_MODE'] = 'false';
        });

        afterEach(() => {
          process.env['NX_BATCH_MODE'] = original;
        });

        it('should begin with no scheduled tasks', () => {
          expect(taskSchedule.nextBatch()).toBeNull();
          expect(taskSchedule.nextTask()).toBeNull();
        });

        it('should schedule root tasks first', async () => {
          // app1 depends on lib1, app2 has no dependencies
          await taskSchedule.scheduleNextTasks();
          expect(taskSchedule.nextTask()).toEqual(lib1Build);
          // since lib1 is not parallel, app2 should not be scheduled even though it has no dependencies
          expect(taskSchedule.nextTask()).toBeNull();
          taskSchedule.complete([lib1Build.id]);
          await taskSchedule.scheduleNextTasks();
          expect(taskSchedule.nextTask()).toEqual(app1Build);
          expect(taskSchedule.nextTask()).toBeNull(); // app2 should not be scheduled since app1 is not parallel and not completed
          taskSchedule.complete([app1Build.id]);
          await taskSchedule.scheduleNextTasks();
          expect(taskSchedule.nextTask()).toEqual(app2Build);
          taskSchedule.complete([app2Build.id]);
          expect(taskSchedule.hasTasks()).toEqual(false);
        });

        it('should not schedule batches', async () => {
          await taskSchedule.scheduleNextTasks();

          expect(taskSchedule.nextTask()).not.toBeNull();

          expect(taskSchedule.nextBatch()).toBeNull();
        });
      });

      describe('With Batch Mode', () => {
        let original;
        beforeEach(() => {
          original = process.env['NX_BATCH_MODE'];
          process.env['NX_BATCH_MODE'] = 'true';
        });

        afterEach(() => {
          process.env['NX_BATCH_MODE'] = original;
        });

        it('should not schedule batches of tasks by different executors if task has parallelism false', async () => {
          await taskSchedule.scheduleNextTasks();

          // since all tasks have parallelism false, they should not be batched
          expect(taskSchedule.nextTask()).toEqual(lib1Build);

          expect(taskSchedule.nextBatch()).toBeNull();
        });
      });
    });

    describe('non-dependent tasks', () => {
      let taskSchedule: TasksSchedule;
      let taskGraph: TaskGraph;
      let app1Test: Task;
      let app2Test: Task;
      let lib1Test: Task;
      beforeEach(async () => {
        // app1, app2, and lib1 do not depend on each other
        // all tasks have parallelism set to false
        app1Test = createMockTask('app1:test', false);
        app2Test = createMockTask('app2:test', false);
        lib1Test = createMockTask('lib1:test', false);

        taskGraph = {
          tasks: {
            'app1:test': app1Test,
            'app2:test': app2Test,
            'lib1:test': lib1Test,
          },
          dependencies: {
            'app1:test': [],
            'app2:test': [],
            'lib1:test': [],
          },
          continuousDependencies: {
            'app1:test': [],
            'app2:test': [],
            'lib1:test': [],
          },
          roots: ['app1:test', 'app2:test', 'lib1:test'],
        };
        vi.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
        vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
          schema: {
            version: 2,
            properties: {},
          },
          implementationFactory: vi.fn(),
          batchImplementationFactory: vi.fn(),
          isNgCompat: true,
          isNxExecutor: true,
        });

        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              data: {
                root: 'app1',
                targets: {
                  test: {
                    executor: 'awesome-executors:test',
                    parallelism: false,
                  },
                },
              },
              name: 'app1',
              type: 'app',
            },
            app2: {
              name: 'app2',
              type: 'app',
              data: {
                root: 'app2',
                targets: {
                  test: {
                    executor: 'awesome-executors:app2-test',
                    parallelism: false,
                  },
                },
              },
            },
            lib1: {
              name: 'lib1',
              type: 'lib',
              data: {
                root: 'lib1',
                targets: {
                  test: {
                    executor: 'awesome-executors:test',
                  },
                },
              },
            },
          } as any,
          dependencies: {
            app1: [
              {
                source: 'app1',
                target: 'lib1',
                type: DependencyType.static,
              },
            ],
            app2: [
              {
                source: 'app2',
                target: 'lib1',
                type: DependencyType.static,
              },
            ],
          },
          externalNodes: {},
          version: '5',
        };
        taskHistory.getEstimatedTaskTimings.mockReturnValue({});
        taskSchedule = new TasksSchedule(
          projectGraph,
          readProjectsConfigurationFromProjectGraph(projectGraph).projects,
          taskGraph,
          {
            lifeCycle,
          }
        );
        await taskSchedule.init();
      });

      describe('Without Batch Mode', () => {
        let original;
        beforeEach(() => {
          original = process.env['NX_BATCH_MODE'];
          process.env['NX_BATCH_MODE'] = 'false';
        });

        afterEach(() => {
          process.env['NX_BATCH_MODE'] = original;
        });

        it('should begin with no scheduled tasks', () => {
          expect(taskSchedule.nextBatch()).toBeNull();
          expect(taskSchedule.nextTask()).toBeNull();
        });

        it('should schedule root tasks in topological order', async () => {
          await taskSchedule.scheduleNextTasks();
          expect(taskSchedule.nextTask()).toEqual(app1Test);
          let nextTask = taskSchedule.nextTask();
          expect(nextTask).not.toEqual(app2Test); // app2 should not be scheduled since app1 is not parallel and not completed
          expect(nextTask).not.toEqual(lib1Test); // lib1 should not be scheduled since app1 is not parallel and not completed
          expect(nextTask).toBeNull();

          taskSchedule.complete([app1Test.id]);
          await taskSchedule.scheduleNextTasks();
          nextTask = taskSchedule.nextTask();
          expect(nextTask).toEqual(app2Test); // app2 should be scheduled since app1 is completed now

          nextTask = taskSchedule.nextTask();
          expect(nextTask).not.toEqual(lib1Test); // lib1 should not be scheduled since app2 is not parallel and not completed
          expect(nextTask).toBeNull();

          taskSchedule.complete([app1Test.id]); // this should not do anything since app1 is already completed
          await taskSchedule.scheduleNextTasks();
          nextTask = taskSchedule.nextTask();
          expect(nextTask).not.toEqual(lib1Test); // lib1 should not be scheduled since app2 is not parallel and not completed
          expect(nextTask).toBeNull();

          taskSchedule.complete([app2Test.id]);
          await taskSchedule.scheduleNextTasks();
          expect(taskSchedule.nextTask()).toEqual(lib1Test); // lib1 should be scheduled since app2 is completed now
          taskSchedule.complete([lib1Test.id]);
          expect(taskSchedule.hasTasks()).toEqual(false);
        });

        it('should not schedule batches', async () => {
          await taskSchedule.scheduleNextTasks();

          expect(taskSchedule.nextTask()).not.toBeNull();

          expect(taskSchedule.nextBatch()).toBeNull();
        });
      });

      describe('With Batch Mode', () => {
        let original;
        beforeEach(() => {
          original = process.env['NX_BATCH_MODE'];
          process.env['NX_BATCH_MODE'] = 'true';
        });

        afterEach(() => {
          process.env['NX_BATCH_MODE'] = original;
        });

        it('should not schedule batches of tasks by different executors if task have parallelism false', async () => {
          await taskSchedule.scheduleNextTasks();

          // app1, app2, and lib1 are not parallel, so they should not be batched
          expect(taskSchedule.nextTask()).toEqual(app1Test);

          expect(taskSchedule.nextBatch()).toBeNull();
        });
      });
    });
  });

  describe('preferBatch', () => {
    let taskSchedule: TasksSchedule;
    let taskGraph: TaskGraph;
    let app1Build: Task;
    let lib1Build: Task;
    let projectGraph: ProjectGraph;
    let originalBatchMode: string | undefined;

    beforeEach(async () => {
      originalBatchMode = process.env['NX_BATCH_MODE'];
      delete process.env['NX_BATCH_MODE'];
      app1Build = createMockTask('app1:build');
      lib1Build = createMockTask('lib1:build');

      taskGraph = {
        tasks: {
          'app1:build': app1Build,
          'lib1:build': lib1Build,
        },
        dependencies: {
          'app1:build': ['lib1:build'],
          'lib1:build': [],
        },
        continuousDependencies: {
          'app1:build': [],
          'lib1:build': [],
        },
        roots: ['lib1:build'],
      };

      projectGraph = {
        nodes: {
          app1: {
            data: {
              root: 'app1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
            name: 'app1',
            type: 'app',
          },
          lib1: {
            name: 'lib1',
            type: 'lib',
            data: {
              root: 'lib1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
          },
        } as any,
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'lib1',
              type: DependencyType.static,
            },
          ],
        },
        externalNodes: {},
        version: '5',
      };

      vi.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
      taskHistory.getEstimatedTaskTimings.mockReturnValue({});
    });

    afterEach(() => {
      process.env['NX_BATCH_MODE'] = originalBatchMode;
    });

    it('should batch tasks when executor has preferBatch: true and --batch not specified', async () => {
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        preferBatch: true,
        isNgCompat: true,
        isNxExecutor: true,
      });

      // Create schedule with batch: undefined (not specified)
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          batch: undefined,
          lifeCycle,
        }
      );
      await taskSchedule.init();
      await taskSchedule.scheduleNextTasks();

      const batch = taskSchedule.nextBatch();
      expect(batch).not.toBeNull();
      expect(batch.executorName).toBe('awesome-executors:build');
    });

    it('should NOT batch when --batch=false even if preferBatch is true', async () => {
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        preferBatch: true,
        isNgCompat: true,
        isNxExecutor: true,
      });

      // Create schedule with batch: false (explicit opt-out)
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          batch: false,
          lifeCycle,
        }
      );
      await taskSchedule.init();
      await taskSchedule.scheduleNextTasks();

      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask()).not.toBeNull();
    });

    it('should batch when --batch=true even without preferBatch', async () => {
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        // preferBatch not set (undefined)
        isNgCompat: true,
        isNxExecutor: true,
      });

      // Create schedule with batch: true (explicit opt-in)
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          batch: true,
          lifeCycle,
        }
      );
      await taskSchedule.init();
      await taskSchedule.scheduleNextTasks();

      const batch = taskSchedule.nextBatch();
      expect(batch).not.toBeNull();
      expect(batch.executorName).toBe('awesome-executors:build');
    });

    it('should NOT batch when --batch not specified and preferBatch not set', async () => {
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        // preferBatch not set (undefined)
        isNgCompat: true,
        isNxExecutor: true,
      });

      // Create schedule with batch: undefined (not specified)
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          batch: undefined,
          lifeCycle,
        }
      );
      await taskSchedule.init();
      await taskSchedule.scheduleNextTasks();

      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask()).not.toBeNull();
    });

    it('should NOT batch when preferBatch is explicitly false', async () => {
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        preferBatch: false,
        isNgCompat: true,
        isNxExecutor: true,
      });

      // Create schedule with batch: undefined (not specified)
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          batch: undefined,
          lifeCycle,
        }
      );
      await taskSchedule.init();
      await taskSchedule.scheduleNextTasks();

      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask()).not.toBeNull();
    });
  });

  describe('batch scheduling with prematurely completed tasks', () => {
    let taskSchedule: TasksSchedule;
    let taskGraph: TaskGraph;
    let lib1Build: Task;
    let app1Build: Task;
    let originalBatchMode: string | undefined;

    beforeEach(async () => {
      originalBatchMode = process.env['NX_BATCH_MODE'];
      process.env['NX_BATCH_MODE'] = 'true';

      lib1Build = createMockTask('lib1:build');
      app1Build = createMockTask('app1:build');
      const app2Build = createMockTask('app2:build');

      taskGraph = {
        tasks: {
          'lib1:build': lib1Build,
          'app1:build': app1Build,
          'app2:build': app2Build,
        },
        dependencies: {
          'lib1:build': [],
          'app1:build': ['lib1:build'],
          'app2:build': ['lib1:build'],
        },
        continuousDependencies: {
          'lib1:build': [],
          'app1:build': [],
          'app2:build': [],
        },
        roots: ['lib1:build'],
      };

      vi.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        isNgCompat: true,
        isNxExecutor: true,
      });

      const projectGraph: ProjectGraph = {
        nodes: {
          lib1: {
            name: 'lib1',
            type: 'lib',
            data: {
              root: 'lib1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
          },
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              root: 'app1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
          },
          app2: {
            name: 'app2',
            type: 'app',
            data: {
              root: 'app2',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
          },
        } as any,
        dependencies: {
          lib1: [],
          app1: [
            {
              source: 'app1',
              target: 'lib1',
              type: DependencyType.static,
            },
          ],
          app2: [
            {
              source: 'app2',
              target: 'lib1',
              type: DependencyType.static,
            },
          ],
        },
        externalNodes: {},
        version: '5',
      };

      taskHistory.getEstimatedTaskTimings.mockReturnValue({});
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          lifeCycle,
        }
      );
      await taskSchedule.init();
    });

    afterEach(() => {
      process.env['NX_BATCH_MODE'] = originalBatchMode;
    });

    it('should not crash when a dependent task was prematurely completed before batch scheduling', async () => {
      // Simulate a premature task failure: app1:build is completed
      // before it or its dependency lib1:build are scheduled.
      // This removes app1 from notScheduledTaskGraph.
      taskSchedule.complete(['app1:build']);

      await taskSchedule.scheduleNextTasks();

      const batch = taskSchedule.nextBatch();
      expect(batch).not.toBeNull();
      expect(batch.taskGraph.tasks).not.toHaveProperty('app1:build');
      expect(batch.taskGraph.tasks).toHaveProperty('lib1:build');
      expect(batch.taskGraph.tasks).toHaveProperty('app2:build');
    });
  });

  describe('nextTask with filter', () => {
    let taskSchedule: TasksSchedule;
    let discreteTask: Task;
    let continuousTask1: Task;
    let continuousTask2: Task;

    beforeEach(async () => {
      discreteTask = createMockTask('app1:build', true, false);
      continuousTask1 = createMockTask('app2:serve', true, true);
      continuousTask2 = createMockTask('app3:serve', true, true);

      const taskGraph: TaskGraph = {
        tasks: {
          'app1:build': discreteTask,
          'app2:serve': continuousTask1,
          'app3:serve': continuousTask2,
        },
        dependencies: {
          'app1:build': [],
          'app2:serve': [],
          'app3:serve': [],
        },
        continuousDependencies: {
          'app1:build': [],
          'app2:serve': [],
          'app3:serve': [],
        },
        roots: ['app1:build', 'app2:serve', 'app3:serve'],
      };

      vi.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
      vi.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: { version: 2, properties: {} },
        implementationFactory: vi.fn(),
        batchImplementationFactory: vi.fn(),
        isNgCompat: true,
        isNxExecutor: true,
      });

      const projectGraph: ProjectGraph = {
        nodes: {
          app1: {
            data: {
              root: 'app1',
              targets: {
                build: { executor: 'awesome-executors:build' },
              },
            },
            name: 'app1',
            type: 'app',
          },
          app2: {
            data: {
              root: 'app2',
              targets: {
                serve: { executor: 'awesome-executors:serve' },
              },
            },
            name: 'app2',
            type: 'app',
          },
          app3: {
            data: {
              root: 'app3',
              targets: {
                serve: { executor: 'awesome-executors:serve' },
              },
            },
            name: 'app3',
            type: 'app',
          },
        } as any,
        dependencies: {},
        externalNodes: {},
        version: '5',
      };

      taskHistory.getEstimatedTaskTimings.mockReturnValue({});
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        {
          lifeCycle,
        }
      );
      await taskSchedule.init();

      process.env['NX_BATCH_MODE'] = 'false';
      await taskSchedule.scheduleNextTasks();
    });

    afterEach(() => {
      delete process.env['NX_BATCH_MODE'];
    });

    it('should return first matching task when filter is provided', () => {
      const task = taskSchedule.nextTask((t) => t.continuous);
      expect(task).toBeDefined();
      expect(task.continuous).toBe(true);
    });

    it('should skip non-matching tasks', () => {
      const task = taskSchedule.nextTask((t) => !t.continuous);
      expect(task).toEqual(discreteTask);
    });

    it('should return null when no tasks match filter', () => {
      // Consume the discrete task
      taskSchedule.nextTask((t) => !t.continuous);
      // No more discrete tasks
      const task = taskSchedule.nextTask((t) => !t.continuous);
      expect(task).toBeNull();
    });

    it('should return first task when no filter is provided', () => {
      const task = taskSchedule.nextTask();
      expect(task).toBeDefined();
    });
  });

  describe('tasks waiting for a continuous dependency to be ready', () => {
    let original: string | undefined;
    let taskSchedule: TasksSchedule;
    let projectGraph: ProjectGraph;
    let projects: Record<string, ProjectConfiguration>;
    let taskGraph: TaskGraph;

    beforeEach(async () => {
      original = process.env['NX_BATCH_MODE'];
      process.env['NX_BATCH_MODE'] = 'true';

      taskGraph = {
        tasks: {
          'app1:build': createMockTask('app1:build'),
          'lib1:build': createMockTask('lib1:build'),
          'app1:serve': createMockTask('app1:serve', true, true),
        },
        dependencies: {
          'app1:build': [],
          'lib1:build': [],
          'app1:serve': [],
        },
        continuousDependencies: {
          'app1:build': ['app1:serve'],
          'lib1:build': [],
          'app1:serve': [],
        },
        roots: ['lib1:build', 'app1:serve'],
      };
      vi.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
      vi.spyOn(executorUtils, 'getExecutorInformation').mockImplementation(
        (_module, executor) => ({
          schema: { version: 2, properties: {} },
          implementationFactory: vi.fn(),
          batchImplementationFactory:
            executor === 'build' ? vi.fn() : undefined,
          isNgCompat: true,
          isNxExecutor: true,
        })
      );
      projectGraph = {
        nodes: {
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              root: 'app1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                  dependsOn: [
                    { projects: ['app1'], target: 'serve', waitFor: 'ready' },
                  ],
                },
                serve: {
                  executor: 'awesome-executors:serve',
                  continuous: true,
                  readyWhen: { logMatches: 'ready' },
                },
              },
            },
          },
          lib1: {
            name: 'lib1',
            type: 'lib',
            data: {
              root: 'lib1',
              targets: { build: { executor: 'awesome-executors:build' } },
            },
          },
        } as any,
        dependencies: { app1: [], lib1: [] },
        externalNodes: {},
        version: '5',
      };
      projects =
        readProjectsConfigurationFromProjectGraph(projectGraph).projects;
      taskHistory.getEstimatedTaskTimings.mockReturnValue({});
      taskSchedule = new TasksSchedule(projectGraph, projects, taskGraph, {
        lifeCycle,
      });
      await taskSchedule.init();
    });

    afterEach(() => {
      process.env['NX_BATCH_MODE'] = original;
    });

    async function createChainSchedule(e2eExecutor = 'awesome-executors:e2e') {
      const taskGraph: TaskGraph = {
        tasks: {
          'db:up': createMockTask('db:up', true, true),
          'api:serve': createMockTask('api:serve', true, true),
          'e2e:e2e': createMockTask('e2e:e2e'),
        },
        dependencies: { 'db:up': [], 'api:serve': [], 'e2e:e2e': [] },
        continuousDependencies: {
          'db:up': [],
          'api:serve': ['db:up'],
          'e2e:e2e': ['api:serve'],
        },
        roots: ['db:up'],
      };
      const projectGraph: ProjectGraph = {
        nodes: {
          db: {
            name: 'db',
            type: 'app',
            data: {
              root: 'db',
              targets: {
                up: {
                  executor: 'awesome-executors:up',
                  continuous: true,
                  readyWhen: { logMatches: 'ready' },
                },
              },
            },
          },
          api: {
            name: 'api',
            type: 'app',
            data: {
              root: 'api',
              targets: {
                serve: {
                  executor: 'awesome-executors:serve',
                  continuous: true,
                  dependsOn: [
                    { projects: ['db'], target: 'up', waitFor: 'ready' },
                  ],
                },
              },
            },
          },
          e2e: {
            name: 'e2e',
            type: 'app',
            data: {
              root: 'e2e',
              targets: {
                e2e: {
                  executor: e2eExecutor,
                  dependsOn: [{ projects: ['api'], target: 'serve' }],
                },
              },
            },
          },
        } as any,
        dependencies: { db: [], api: [], e2e: [] },
        externalNodes: {},
        version: '5',
      };
      const taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        { lifeCycle }
      );
      await taskSchedule.init();
      return { taskSchedule };
    }

    it('holds back the dependents of such a task until it has started', async () => {
      const { taskSchedule } = await createChainSchedule();
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextTask()?.id).toBe('db:up');
      taskSchedule.markReady('db:up');
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextTask()?.id).toBe('api:serve');

      // api:serve is queued but waits for db:up, so e2e:e2e is not released
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextTask()).toBeNull();

      taskSchedule.markContinuousTaskStarted('api:serve');
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextTask()?.id).toBe('e2e:e2e');
    });

    it('holds back a batchable dependent of such a task until it has started', async () => {
      // The build executor is the one the harness gives a batch implementation
      const { taskSchedule } = await createChainSchedule(
        'awesome-executors:build'
      );
      await taskSchedule.scheduleNextTasks();
      taskSchedule.nextTask();
      taskSchedule.markReady('db:up');
      await taskSchedule.scheduleNextTasks();
      taskSchedule.nextTask();

      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask()).toBeNull();

      taskSchedule.markContinuousTaskStarted('api:serve');
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toMatchObject({
        taskGraph: { tasks: { 'e2e:e2e': expect.anything() } },
      });
    });

    async function scheduleUntilProducerRuns() {
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toMatchObject({
        executorName: 'awesome-executors:build',
        taskGraph: { tasks: { 'lib1:build': expect.anything() } },
      });
      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask((t) => t.continuous)?.id).toBe('app1:serve');
    }

    it('keeps such a task out of batches and holds it while the producer is not ready', async () => {
      await scheduleUntilProducerRuns();

      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask((t) => !t.continuous)).toBeNull();

      taskSchedule.markReady('app1:serve');
      taskSchedule.markReadinessPending('app1:serve');
      expect(taskSchedule.nextTask((t) => !t.continuous)).toBeNull();

      taskSchedule.markReady('app1:serve');
      expect(taskSchedule.nextTask((t) => !t.continuous)?.id).toBe(
        'app1:build'
      );
    });

    it('batches such a task once the producer is ready', async () => {
      await scheduleUntilProducerRuns();

      taskSchedule.markReady('app1:serve');
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toMatchObject({
        taskGraph: { tasks: { 'app1:build': expect.anything() } },
      });
    });

    it('runs such a task on its own once the producer has failed to become ready', async () => {
      await scheduleUntilProducerRuns();

      taskSchedule.markReadinessFailed('app1:serve');
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask((t) => !t.continuous)?.id).toBe(
        'app1:build'
      );
    });

    it('skips a held task in place and reports the producer it waits on', async () => {
      process.env['NX_BATCH_MODE'] = 'false';
      const onReadinessHold = vi.fn();
      const flatTaskGraph: TaskGraph = {
        tasks: {
          'app1:build': createMockTask('app1:build'),
          'lib1:build': createMockTask('lib1:build'),
          'app1:serve': createMockTask('app1:serve', true, true),
        },
        dependencies: { 'app1:build': [], 'lib1:build': [], 'app1:serve': [] },
        continuousDependencies: {
          'app1:build': ['app1:serve'],
          'lib1:build': [],
          'app1:serve': [],
        },
        roots: ['app1:serve', 'lib1:build'],
      };
      // A known timing sorts lib1:build behind app1:build
      taskHistory.getEstimatedTaskTimings.mockReturnValue({
        'lib1:build': 10,
      });
      taskSchedule = new TasksSchedule(
        projectGraph,
        projects,
        flatTaskGraph,
        { lifeCycle },
        flatTaskGraph,
        { onReadinessHold }
      );
      await taskSchedule.init();

      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextTask((t) => t.continuous)?.id).toBe('app1:serve');
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextTask((t) => !t.continuous)?.id).toBe(
        'lib1:build'
      );
      expect(onReadinessHold).toHaveBeenCalledWith('app1:serve');
      expect(taskSchedule.nextTask((t) => t.continuous)).toBeNull();
      expect(onReadinessHold).toHaveBeenCalledTimes(1);

      taskSchedule.markReady('app1:serve');
      expect(taskSchedule.nextTask((t) => !t.continuous)?.id).toBe(
        'app1:build'
      );
    });

    it('starts a continuous task waiting on a producer without a probe on its own', async () => {
      const taskGraph: TaskGraph = {
        tasks: {
          'db:up': createMockTask('db:up', true, true),
          'api:build': createMockTask('api:build', true, true),
          'e2e:build': createMockTask('e2e:build'),
        },
        dependencies: { 'db:up': [], 'api:build': [], 'e2e:build': [] },
        continuousDependencies: {
          'db:up': [],
          'api:build': ['db:up'],
          'e2e:build': ['api:build'],
        },
        roots: ['db:up'],
      };
      const projectGraph: ProjectGraph = {
        nodes: {
          db: {
            name: 'db',
            type: 'app',
            data: {
              root: 'db',
              targets: {
                up: { executor: 'awesome-executors:up', continuous: true },
              },
            },
          },
          api: {
            name: 'api',
            type: 'app',
            data: {
              root: 'api',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                  continuous: true,
                  dependsOn: [
                    { projects: ['db'], target: 'up', waitFor: 'ready' },
                  ],
                },
              },
            },
          },
          e2e: {
            name: 'e2e',
            type: 'app',
            data: {
              root: 'e2e',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                  dependsOn: [{ projects: ['api'], target: 'build' }],
                },
              },
            },
          },
        } as any,
        dependencies: { db: [], api: [], e2e: [] },
        externalNodes: {},
        version: '5',
      };
      taskSchedule = new TasksSchedule(
        projectGraph,
        readProjectsConfigurationFromProjectGraph(projectGraph).projects,
        taskGraph,
        { lifeCycle }
      );
      await taskSchedule.init();

      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextTask()?.id).toBe('db:up');
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask()?.id).toBe('api:build');

      // Its dependents are released once it has started, not before
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toBeNull();
      taskSchedule.markContinuousTaskStarted('api:build');
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextBatch()).toMatchObject({
        taskGraph: { tasks: { 'e2e:build': expect.anything() } },
      });
    });

    describe('producer run by another process', () => {
      // An Nx Cloud agent worker gets one task with a flat graph and the
      // full graph the coordinator built
      function createWorkerSchedule(readiness: TaskReadiness | null) {
        const workerTaskGraph: TaskGraph = {
          tasks: { 'app1:build': taskGraph.tasks['app1:build'] },
          dependencies: { 'app1:build': [] },
          continuousDependencies: { 'app1:build': [] },
          roots: ['app1:build'],
        };
        return new TasksSchedule(
          projectGraph,
          projects,
          workerTaskGraph,
          { lifeCycle },
          taskGraph,
          { readinessElsewhere: () => readiness }
        );
      }

      it('batches the task when the row says ready', async () => {
        const schedule = createWorkerSchedule(TaskReadiness.Ready);
        await schedule.init();
        await schedule.scheduleNextTasks();
        expect(schedule.nextBatch()).toMatchObject({
          taskGraph: { tasks: { 'app1:build': expect.anything() } },
        });
      });

      // The run waits on the row itself; a hold here has nothing to wake it
      it.each([
        ['pending', TaskReadiness.Pending],
        ['failed', TaskReadiness.Failed],
        ['there is no row', null],
      ])(
        'runs the task on its own when the row says %s',
        async (_, readiness) => {
          const schedule = createWorkerSchedule(readiness);
          await schedule.init();
          await schedule.scheduleNextTasks();
          expect(schedule.nextBatch()).toBeNull();
          expect(schedule.nextTask()?.id).toBe('app1:build');
        }
      );
    });
  });
});
