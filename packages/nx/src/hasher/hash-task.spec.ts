import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { hashTasksThatDoNotDependOnOutputsOfOtherTasks } from './hash-task';

vi.mock('../tasks-runner/task-env', async () => ({
  ...(await vi.importActual('../tasks-runner/task-env')),
  getTaskSpecificEnv: vi.fn(() => process.env),
}));

vi.mock('../tasks-runner/utils', async () => ({
  ...(await vi.importActual('../tasks-runner/utils')),
  getCustomHasher: vi.fn(() => null),
}));

describe('hashTasksThatDoNotDependOnOutputsOfOtherTasks', () => {
  function createTask(id: string, outputs: string[]): Task {
    const [project, target] = id.split(':');
    return {
      id,
      target: { project, target },
      overrides: {},
      outputs,
      projectRoot: project,
      cache: true,
      parallelism: true,
    } as Task;
  }

  const projectGraph = {
    nodes: {
      app: {
        name: 'app',
        type: 'app',
        data: {
          root: 'app',
          targets: {
            build: {
              inputs: [
                { dependentTasksOutputFiles: '**/*.d.ts', transitive: true },
              ],
            },
          },
        },
      },
      lib: {
        name: 'lib',
        type: 'lib',
        data: { root: 'lib', targets: { build: {} } },
      },
      tool: {
        name: 'tool',
        type: 'lib',
        data: { root: 'tool', targets: { install: {} } },
      },
    },
    dependencies: { app: [], lib: [], tool: [] },
    externalNodes: {},
  } as unknown as ProjectGraph;

  function hashedIds(taskGraph: TaskGraph) {
    const hasher = {
      hashTasks: vi.fn(async (tasks: Task[]) =>
        tasks.map((t) => ({ value: `${t.id}|hash`, details: {} }))
      ),
    };
    return hashTasksThatDoNotDependOnOutputsOfOtherTasks(
      hasher as any,
      projectGraph,
      taskGraph,
      {},
      null
    ).then(() => hasher.hashTasks.mock.calls[0][0].map((t: Task) => t.id));
  }

  it('defers a task whose dep outputs feed its hash', async () => {
    const taskGraph: TaskGraph = {
      roots: ['lib:build'],
      tasks: {
        'app:build': createTask('app:build', ['dist/app']),
        'lib:build': createTask('lib:build', ['dist/lib']),
      },
      dependencies: { 'app:build': ['lib:build'], 'lib:build': [] },
      continuousDependencies: { 'app:build': [], 'lib:build': [] },
    };
    expect(await hashedIds(taskGraph)).toEqual(['lib:build']);
  });

  it('hashes a task up front when its only deps declare no outputs', async () => {
    const taskGraph: TaskGraph = {
      roots: ['tool:install'],
      tasks: {
        'app:build': createTask('app:build', ['dist/app']),
        'tool:install': createTask('tool:install', []),
      },
      dependencies: { 'app:build': ['tool:install'], 'tool:install': [] },
      continuousDependencies: { 'app:build': [], 'tool:install': [] },
    };
    expect(await hashedIds(taskGraph)).toEqual(['app:build', 'tool:install']);
  });
});
