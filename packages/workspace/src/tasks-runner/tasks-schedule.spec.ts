import { TasksSchedule } from './tasks-schedule';
import { Task, TaskGraph } from '@nrwl/devkit';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { removeTasksFromTaskGraph } from '@nrwl/workspace/src/tasks-runner/utils';

function createMockTask(id: string): Task {
  const [project, target] = id.split(':');
  return {
    id,
    target: {
      project,
      target,
    },
    overrides: {},
  };
}

describe('TasksSchedule', () => {
  let taskSchedule: TasksSchedule;
  let taskGraph: TaskGraph;
  let app1Build: Task;
  let app2Build: Task;
  let lib1Build: Task;
  beforeEach(() => {
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
    const workspace: Partial<Workspaces> = {
      readExecutor() {
        return {
          schema: {},
          implementationFactory: jest.fn(),
          batchImplementationFactory: jest.fn(),
        };
      },

      readWorkspaceConfiguration() {
        return {
          version: 2,
          npmScope: '',
          projects: {
            app1: {
              root: 'app1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
            app2: {
              root: 'app2',
              targets: {
                build: {
                  executor: 'awesome-executors:app2-build',
                },
              },
            },
            lib1: {
              root: 'lib1',
              targets: {
                build: {
                  executor: 'awesome-executors:build',
                },
              },
            },
          },
        };
      },
    };

    const hasher = {
      hashTaskWithDepsAndContext: () => 'hash',
    } as any;

    taskSchedule = new TasksSchedule(
      hasher,
      taskGraph,
      workspace as Workspaces,
      {
        lifeCycle: {
          startTask: jest.fn(),
          endTask: jest.fn(),
          scheduleTask: jest.fn(),
        },
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
