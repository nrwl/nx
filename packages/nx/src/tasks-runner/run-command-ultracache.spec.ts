import type { Task, TaskGraph } from '../config/task-graph';
import type { UltracacheMode } from '../ultracache/mode';
import { invokeTasksRunner } from './run-command';

const hashing = vi.hoisted(() => ({ assertModes: vi.fn() }));
vi.mock('../hasher/create-task-hasher', () => ({
  createTaskHasher: () => ({}),
}));
vi.mock('../hasher/hash-task', () => ({
  getTaskDetails: () => ({}),
  hashTasksThatDoNotDependOnOutputsOfOtherTasks: async (
    _hasher,
    _projectGraph,
    taskGraph
  ) => {
    hashing.assertModes(taskGraph);
    return [];
  },
}));

describe('initiating task modes', () => {
  let originalRunner: unknown;
  let runnerModule: NodeModule;
  const runner = vi.fn();
  beforeEach(() => {
    // getRunner uses Node's require channel rather than Vite's module mocks.
    const path = require.resolve('./default-tasks-runner');
    require(path);
    runnerModule = require.cache[path];
    originalRunner = runnerModule.exports;
    runnerModule.exports = runner;
  });
  afterEach(() => {
    runnerModule.exports = originalRunner;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it.each([
    ['warn', undefined, ['warn', 'on', 'off']],
    ['error', undefined, ['error', 'on', 'off']],
    ['off', undefined, ['off', 'on', 'off']],
    ['warn', 'off', ['off', 'off', 'off']],
    ['off', 'on', ['on', 'on', 'on']],
  ] as const)(
    'resolves workspace %s/env %s before hashing and handing the graph to the runner',
    async (defaultMode, override, expected) => {
      vi.stubEnv('NX_CLOUD_ULTRACACHE_MODE', override);
      const tasks = [undefined, 'on', 'off'].map((mode, index) => ({
        id: `app:task${index}`,
        target: { project: 'app', target: `task${index}` },
        overrides: {},
        outputs: [],
        cache: true,
        ultracache: mode ? { mode: mode as UltracacheMode } : undefined,
      })) as Task[];
      const taskGraph: TaskGraph = {
        tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
        roots: tasks.map((t) => t.id),
        dependencies: {},
        continuousDependencies: {},
      };
      const assertModes = (graph: TaskGraph) =>
        expect(
          Object.values(graph.tasks).map((t) => t.ultracache.mode)
        ).toEqual(expected);
      hashing.assertModes.mockImplementation(assertModes);
      runner.mockImplementation(
        async (received, _options, { taskGraph: graph }) => {
          expect(hashing.assertModes).toHaveBeenCalledOnce();
          assertModes(graph);
          expect(received.map((t) => t.ultracache.mode)).toEqual(expected);
          return {};
        }
      );
      await invokeTasksRunner({
        tasks,
        taskGraph,
        projectGraph: { nodes: {}, dependencies: {} },
        lifeCycle: {},
        nxArgs: {},
        loadDotEnvFiles: false,
        initiatingProject: null,
        initiatingTasks: tasks,
        nxJson: { neverConnectToCloud: true },
        ultracacheConfigurationOutcome: {
          status: 'fetched',
          configurations: { resolution: { defaultMode, tasks: 0 } } as any,
        },
      });
      expect(runner).toHaveBeenCalledOnce();
    }
  );
});
