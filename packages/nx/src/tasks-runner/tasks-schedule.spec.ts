import { TasksSchedule } from './tasks-schedule';
import { Workspaces } from '../config/workspaces';
import { removeTasksFromTaskGraph } from './utils';
import { Task, TaskGraph } from '../config/task-graph';
import { ProjectGraph } from '../config/project-graph';

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
  let lifeCycle: any;
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
    };

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
      },
      dependencies: {},
      allWorkspaceFiles: [],
      externalNodes: {},
      version: '5',
    };

    const hasher = {
      hashTaskWithDepsAndContext: () => 'hash',
    } as any;

    lifeCycle = {
      startTask: jest.fn(),
      endTask: jest.fn(),
      scheduleTask: jest.fn(),
    };
    taskSchedule = new TasksSchedule(
      hasher,
      {},
      projectGraph,
      taskGraph,
      workspace as Workspaces,
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

    it('should begin with no scheduled tasks', () => {
      expect(taskSchedule.nextBatch()).toBeNull();
      expect(taskSchedule.nextTask()).toBeNull();
    });

    it('should schedule root tasks first', async () => {
      await taskSchedule.scheduleNextTasks();
      expect(taskSchedule.nextTask()).toEqual(lib1Build);
      expect(taskSchedule.nextTask()).toEqual(app2Build);
    });

    it('should invoke lifeCycle.scheduleTask', async () => {
      await taskSchedule.scheduleNextTasks();
      expect(lifeCycle.scheduleTask).toHaveBeenCalled();
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
