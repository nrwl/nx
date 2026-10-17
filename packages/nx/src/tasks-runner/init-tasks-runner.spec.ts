const createTaskHasher = vi.fn(() => ({}));

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
  afterEach(() => vi.unstubAllEnvs());

  it.each(['on', 'warn', 'error', 'off'])(
    'applies the workspace default %s to Cloud tasks before hashing',
    async (mode) => {
      vi.stubEnv('NX_CLOUD_ULTRACACHE_MODE', mode);
      vi.stubEnv('NX_CLOUD_USE_ULTRACACHE', undefined);
      const pendingTask = { ...task, ultracache: { collectStats: true } };
      const explicitTask = {
        ...task,
        id: 'app:explicit',
        ultracache: { mode: 'on' },
      };
      const graph = {
        ...fullTaskGraph,
        tasks: {
          [pendingTask.id]: pendingTask,
          [explicitTask.id]: explicitTask,
        },
      };
      createTaskHasher.mockImplementationOnce(() => {
        expect(pendingTask.ultracache).toEqual({ collectStats: true, mode });
        expect(explicitTask.ultracache).toEqual({ mode: 'on' });
        return {};
      });
      await run([pendingTask], projectGraph, graph, {}, {} as any);
      expect(createTaskHasher).toHaveBeenCalledWith(
        projectGraph,
        {},
        { accessToken: 't' },
        undefined
      );
      expect(process.env.NX_CLOUD_USE_ULTRACACHE).toBeUndefined();
    }
  );

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
