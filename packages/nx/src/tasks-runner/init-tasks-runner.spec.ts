const applyIoSnapshotOutputs = vi.fn();
const createTaskHasher = vi.fn(() => ({}));

vi.mock('../io-snapshots/outputs', () => ({
  applyIoSnapshotOutputs: (...args: unknown[]) =>
    applyIoSnapshotOutputs(...args),
}));
vi.mock('../hasher/create-task-hasher', () => ({
  createTaskHasher: (...args: unknown[]) => createTaskHasher(...args),
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
      processAllScheduledTasks: vi.fn(),
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

  it('hashes and extends outputs from the set the caller passes', async () => {
    const snapshots = { commit: 'head', resolution: { fetchedAt: 1 } } as any;

    await run([task], projectGraph, fullTaskGraph, {}, {} as any, snapshots);

    expect(applyIoSnapshotOutputs).toHaveBeenCalledWith(
      projectGraph,
      fullTaskGraph,
      snapshots
    );
    expect(createTaskHasher).toHaveBeenCalledWith(
      projectGraph,
      {},
      { accessToken: 't' },
      snapshots
    );
  });

  it('treats a null hash as unset before it reaches the native bindings', async () => {
    // Nx Cloud agents clear the assigned copy's hash to force a rehash.
    const assigned = {
      id: 'app:build',
      target: { project: 'app', target: 'build' },
      outputs: ['dist/app'],
      hash: null,
      hashDetails: null,
      cache: true,
    } as any;
    const graph = {
      roots: ['app:build'],
      tasks: {
        'app:build': {
          id: 'app:build',
          target: { project: 'app', target: 'build' },
          outputs: ['dist/app'],
          hash: 'main-job-hash',
          cache: true,
        },
      },
      dependencies: { 'app:build': [] },
      continuousDependencies: { 'app:build': [] },
    } as any;
    const fullGraphTask = { ...graph.tasks['app:build'] };

    await run([assigned], projectGraph, graph, {}, {} as any, {} as any);

    expect(assigned).toEqual({
      id: 'app:build',
      target: { project: 'app', target: 'build' },
      outputs: ['dist/app'],
      cache: true,
    });
    expect(graph.tasks['app:build']).toEqual(fullGraphTask);
  });

  it('hashes natively when the caller passes no set', async () => {
    await run([task], projectGraph, fullTaskGraph, {}, {} as any);

    expect(applyIoSnapshotOutputs).not.toHaveBeenCalled();
    expect(createTaskHasher).toHaveBeenCalledWith(
      projectGraph,
      {},
      { accessToken: 't' },
      undefined
    );
  });
});
