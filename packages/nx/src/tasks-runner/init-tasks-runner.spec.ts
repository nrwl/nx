const createTaskHasher = vi.fn(() => ({}));

vi.mock('../hasher/create-task-hasher', () => ({
  createTaskHasher: (...args: unknown[]) => createTaskHasher(...args),
}));
const hashTasksThatDoNotDependOnOutputsOfOtherTasks = vi.fn(
  async (..._: unknown[]) => new Set<string>()
);
vi.mock('../hasher/hash-task', () => ({
  getTaskDetails: () => null,
  hashTasksThatDoNotDependOnOutputsOfOtherTasks: (...args: unknown[]) =>
    hashTasksThatDoNotDependOnOutputsOfOtherTasks(...args),
}));
vi.mock('../utils/dotenv', () => ({ loadRootEnvFiles: vi.fn() }));
vi.mock('./run-command', () => ({
  constructLifeCycles: () => [],
  getRunner: () => ({ runnerOptions: { accessToken: 't' } }),
  setEnvVarsBasedOnArgs: vi.fn(),
}));
vi.mock('./task-orchestrator', () => ({
  TaskOrchestrator: vi.fn(function () {
    return {
      init: vi.fn(),
      processTasks: vi.fn(),
      nextBatch: () => null,
      resolveCachedTasks: async () => [],
      runTaskDirectly: async (_: boolean, task: any) => ({ task }),
      startContinuousTask: async () => ({}),
      waitForContinuousTaskExit: async () => undefined,
      dispose: vi.fn(),
    };
  }),
}));

import { runContinuousTasks, runDiscreteTasks } from './init-tasks-runner';
import { TaskOrchestrator } from './task-orchestrator';

describe.each([
  ['runDiscreteTasks', runDiscreteTasks],
  ['runContinuousTasks', runContinuousTasks],
])('%s', (_, run) => {
  const task = {
    id: 'app:build',
    target: { project: 'app', target: 'build' },
    outputs: ['dist/app'],
  } as any;
  const fullTaskGraph = {
    roots: ['app:build'],
    tasks: { 'app:build': task },
    dependencies: { 'app:build': [] },
    continuousDependencies: { 'app:build': [] },
  } as any;
  const projectGraph = { nodes: {}, dependencies: {} } as any;

  beforeEach(() => vi.clearAllMocks());

  it('hashes from the configurations the caller passes', async () => {
    const configurations = {
      commit: 'head',
      resolution: { fetchedAt: 1 },
    } as any;

    await run(
      [task],
      projectGraph,
      fullTaskGraph,
      {},
      {} as any,
      configurations
    );

    expect(createTaskHasher).toHaveBeenCalledWith(
      projectGraph,
      {},
      { accessToken: 't' },
      configurations
    );
  });

  it('hashes natively when the caller passes no set', async () => {
    await run([task], projectGraph, fullTaskGraph, {}, {} as any);

    expect(createTaskHasher).toHaveBeenCalledWith(
      projectGraph,
      {},
      { accessToken: 't' },
      undefined
    );
  });
});

describe('tasks of one call that depend on each other', () => {
  const taskOf = (id: string) =>
    ({ id, target: { project: id.split(':')[0], target: 'build' } }) as any;
  const a = taskOf('a:build');
  const b = taskOf('b:build');
  const c = taskOf('c:build');
  // a <- b <- c
  const fullTaskGraph = {
    roots: ['a:build'],
    tasks: { 'a:build': a, 'b:build': b, 'c:build': c },
    dependencies: {
      'a:build': [],
      'b:build': [{ id: 'a:build' }],
      'c:build': [{ id: 'b:build' }],
    },
    continuousDependencies: { 'a:build': [], 'b:build': [], 'c:build': [] },
  } as any;
  const projectGraph = { nodes: {}, dependencies: {} } as any;
  // TaskOrchestrator's task graph and hashingDeferredTaskIds arguments
  const orchestratorArguments = () => {
    const args = vi.mocked(TaskOrchestrator).mock.calls[0] as unknown[];
    return { taskGraph: args[4] as any, hashingDeferredTaskIds: args[12] };
  };

  beforeEach(() => vi.clearAllMocks());

  it('keeps the dependencies between the discrete tasks and defers the hashes the hasher holds back', async () => {
    const deferred = new Set(['c:build']);
    hashTasksThatDoNotDependOnOutputsOfOtherTasks.mockResolvedValueOnce(
      deferred
    );

    // a:build completed before this call
    await runDiscreteTasks([b, c], projectGraph, fullTaskGraph, {}, {} as any);

    const { taskGraph, hashingDeferredTaskIds } = orchestratorArguments();
    expect(taskGraph.roots).toEqual(['b:build']);
    expect(taskGraph.dependencies).toEqual({
      'b:build': [],
      'c:build': [{ id: 'b:build' }],
    });
    expect(hashingDeferredTaskIds).toBe(deferred);
    // Hashes from the whole graph, but only the tasks of this call
    const [, , graph, , , , tasks] =
      hashTasksThatDoNotDependOnOutputsOfOtherTasks.mock.calls[0];
    expect(graph).toEqual(fullTaskGraph);
    expect(tasks).toEqual([b, c]);
  });

  it('hashes discrete tasks that do not depend on each other as before', async () => {
    await runDiscreteTasks([a, c], projectGraph, fullTaskGraph, {}, {} as any);

    const { taskGraph, hashingDeferredTaskIds } = orchestratorArguments();
    expect(taskGraph.roots).toEqual(['a:build', 'c:build']);
    expect(taskGraph.dependencies).toEqual({ 'a:build': [], 'c:build': [] });
    expect(hashingDeferredTaskIds).toBeUndefined();
    expect(
      hashTasksThatDoNotDependOnOutputsOfOtherTasks
    ).not.toHaveBeenCalled();
  });

  it('keeps the dependencies between continuous tasks without hashing them up front', async () => {
    const serve = (project: string) =>
      ({
        id: `${project}:serve`,
        target: { project, target: 'serve' },
        continuous: true,
      }) as any;
    const api = serve('api');
    const app = serve('app');
    // app:serve uses api:serve
    const continuousTaskGraph = {
      roots: ['api:serve'],
      tasks: { 'api:serve': api, 'app:serve': app },
      dependencies: { 'api:serve': [], 'app:serve': [] },
      continuousDependencies: {
        'api:serve': [],
        'app:serve': [{ id: 'api:serve' }],
      },
    } as any;

    await runContinuousTasks(
      [api, app],
      projectGraph,
      continuousTaskGraph,
      {},
      {} as any
    );

    const { taskGraph, hashingDeferredTaskIds } = orchestratorArguments();
    expect(taskGraph.roots).toEqual(['api:serve']);
    expect(taskGraph.continuousDependencies).toEqual({
      'api:serve': [],
      'app:serve': [{ id: 'api:serve' }],
    });
    expect(hashingDeferredTaskIds).toBeUndefined();
    expect(
      hashTasksThatDoNotDependOnOutputsOfOtherTasks
    ).not.toHaveBeenCalled();
  });
});
