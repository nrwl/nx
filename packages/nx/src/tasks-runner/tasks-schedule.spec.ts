import { TasksSchedule } from './tasks-schedule';
import { removeTasksFromTaskGraph } from './utils';
import { Task, TaskGraph } from '../config/task-graph';
import { DependencyType, ProjectGraph } from '../config/project-graph';
import * as nxJsonUtils from '../config/nx-json';
import * as executorUtils from '../command-line/run/executor-utils';
import * as taskHistoryUtils from '../utils/task-history';
import type { LifeCycle } from './life-cycle';

function createMockTask(id: string, parallelism: boolean = true): Task {
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
  };
}

describe('TasksSchedule', () => {
  let taskHistory: any;
  let lifeCycle: LifeCycle;

  beforeEach(() => {
    lifeCycle = {
      startTask: jest.fn(),
      endTask: jest.fn(),
      scheduleTask: jest.fn(),
    };
    taskHistory = {
      getEstimatedTaskTimings: jest.fn(),
      getFlakyTasks: jest.fn(),
      recordTaskRuns: jest.fn(),
    };
    jest.spyOn(taskHistoryUtils, 'getTaskHistory').mockReturnValue(taskHistory);
  });

  afterEach(() => {
    jest.resetAllMocks();
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
        roots: ['lib1:build', 'app2:build'],
      };
      jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
      jest.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: jest.fn(),
        batchImplementationFactory: jest.fn(),
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
      taskSchedule = new TasksSchedule(projectGraph, taskGraph, {
        lifeCycle,
      });
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
          taskGraph: removeTasksFromTaskGraph(taskGraph, ['app2:build']),
        });
        expect(taskSchedule.nextBatch()).toEqual({
          executorName: 'awesome-executors:app2-build',
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
        roots: [
          'app1:test',
          'app2:test',
          'lib1:test',
          'app3:test',
          'app4:test',
        ],
      };
      jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
      jest.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
        schema: {
          version: 2,
          properties: {},
        },
        implementationFactory: jest.fn(),
        batchImplementationFactory: jest.fn(),
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
      taskSchedule = new TasksSchedule(projectGraph, taskGraph, {
        lifeCycle,
      });
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
          taskGraph: removeTasksFromTaskGraph(taskGraph, [
            'app2:test',
            'app3:test',
            'app4:test',
          ]),
        });
        expect(taskSchedule.nextBatch()).toEqual({
          executorName: 'awesome-executors:app2-test',
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
          roots: ['lib1:build', 'app2:build'],
        };
        jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
        jest.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
          schema: {
            version: 2,
            properties: {},
          },
          implementationFactory: jest.fn(),
          batchImplementationFactory: jest.fn(),
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
        taskSchedule = new TasksSchedule(projectGraph, taskGraph, {
          lifeCycle,
        });
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
          roots: ['app1:test', 'app2:test', 'lib1:test'],
        };
        jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});
        jest.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
          schema: {
            version: 2,
            properties: {},
          },
          implementationFactory: jest.fn(),
          batchImplementationFactory: jest.fn(),
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
        taskSchedule = new TasksSchedule(projectGraph, taskGraph, {
          lifeCycle,
        });
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
});
