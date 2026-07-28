import { stripVTControlCharacters } from 'util';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { TaskOrchestrator } from './task-orchestrator';

performance.mark = jest.fn((name: string) => ({ name }) as PerformanceMark);
performance.measure = jest.fn();

jest.mock('./task-env', () => ({
  ...jest.requireActual('./task-env'),
  getTaskSpecificEnv: jest.fn(() => process.env),
}));

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  getCustomHasher: jest.fn(() => null),
}));

describe('TaskOrchestrator', () => {
  describe('batch re-hash of depsOutputs tasks', () => {
    function createTask(id: string): Task {
      const [project, target] = id.split(':');
      return {
        id,
        target: { project, target },
        overrides: {},
        outputs: [`{workspaceRoot}/dist/${project}`],
        projectRoot: project,
        cache: true,
        parallelism: true,
      } as Task;
    }

    function createProjectGraph(): ProjectGraph {
      const node = (name: string, inputs?: unknown[]) => ({
        name,
        type: 'lib' as const,
        data: {
          root: name,
          targets: {
            build: {
              executor: 'my-plugin:build',
              ...(inputs ? { inputs } : {}),
            },
          },
        },
      });
      return {
        nodes: {
          dep: node('dep'),
          consumer: node('consumer', [
            { dependentTasksOutputFiles: '**/*.jar', transitive: true },
          ]),
        },
        dependencies: {
          dep: [],
          consumer: [{ source: 'consumer', target: 'dep', type: 'static' }],
        },
        externalNodes: {},
      } as unknown as ProjectGraph;
    }

    function createOrchestrator(taskGraph: TaskGraph) {
      let hasherCallCount = 0;
      const hasher = {
        hashTasks: jest.fn(async (tasks: Task[]) => {
          hasherCallCount++;
          return tasks.map((t) => ({
            value: `${t.id}|call-${hasherCallCount}`,
            details: {
              command: 'cmd',
              nodes: {},
              implicitDeps: {},
              runtime: {},
            },
          }));
        }),
      };

      // Bypass the constructor — its field initializers open db connections
      // and fork processes that this test doesn't need.
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      orchestrator.hasher = hasher;
      orchestrator.projectGraph = createProjectGraph();
      orchestrator.taskGraph = taskGraph;
      orchestrator.fullTaskGraph = taskGraph;
      orchestrator.nxJson = {};
      orchestrator.taskDetails = null;
      orchestrator.taskInvocationTracker = null;
      orchestrator.completedTasks = new Map();
      orchestrator.options = { lifeCycle: { scheduleTask: jest.fn() } };
      orchestrator.forkedProcessTaskRunner = {
        cleanUpBatchProcesses: jest.fn(),
      };
      orchestrator.applyCachedResults = jest.fn().mockResolvedValue([]);
      orchestrator.preRunSteps = jest.fn();
      const hashesAtCacheTime: Record<string, string> = {};
      orchestrator.postRunSteps = jest.fn(async (results: any[]) => {
        for (const r of results) {
          hashesAtCacheTime[r.task.id] = r.task.hash;
          orchestrator.completedTasks.set(r.task.id, r.status);
        }
      });
      orchestrator.runBatch = jest.fn(async (batch: any) =>
        Object.values(batch.taskGraph.tasks).map((task) => ({
          task,
          status: 'success',
          code: 0,
        }))
      );

      return { orchestrator, hasher, hashesAtCacheTime };
    }

    it('should re-hash tasks with depsOutputs inputs after their deps execute in the same batch', async () => {
      const dep = createTask('dep:build');
      const consumer = createTask('consumer:build');
      const taskGraph: TaskGraph = {
        roots: ['dep:build'],
        tasks: { 'dep:build': dep, 'consumer:build': consumer },
        dependencies: { 'dep:build': [], 'consumer:build': ['dep:build'] },
        continuousDependencies: { 'dep:build': [], 'consumer:build': [] },
      };
      const { orchestrator, hasher, hashesAtCacheTime } =
        createOrchestrator(taskGraph);

      await orchestrator.applyFromCacheOrRunBatch(
        true,
        { id: 'batch-1', executorName: 'my-plugin:batch', taskGraph },
        0
      );

      // Preliminary hashes: dep (call 1), consumer (call 2). The consumer's
      // preliminary hash predates the dep's outputs being written, so a third
      // call must re-hash the consumer after the batch ran.
      expect(hasher.hashTasks).toHaveBeenCalledTimes(3);
      expect(hasher.hashTasks.mock.calls[2][0].map((t: Task) => t.id)).toEqual([
        'consumer:build',
      ]);
      expect(consumer.hash).toBe('consumer:build|call-3');
      expect(dep.hash).toBe('dep:build|call-1');

      // The re-hashed value is what gets cached, not the preliminary one
      expect(hashesAtCacheTime['consumer:build']).toBe('consumer:build|call-3');
      expect(hashesAtCacheTime['dep:build']).toBe('dep:build|call-1');
    });

    it('should not re-hash tasks whose deps were all cache hits', async () => {
      const dep = createTask('dep:build');
      const consumer = createTask('consumer:build');
      const taskGraph: TaskGraph = {
        roots: ['dep:build'],
        tasks: { 'dep:build': dep, 'consumer:build': consumer },
        dependencies: { 'dep:build': [], 'consumer:build': ['dep:build'] },
        continuousDependencies: { 'dep:build': [], 'consumer:build': [] },
      };
      const { orchestrator, hasher } = createOrchestrator(taskGraph);
      // dep resolves from cache, so its outputs are already settled on disk
      // when the consumer's hash is computed
      orchestrator.applyCachedResults = jest.fn(async (tasks: Task[]) =>
        tasks
          .filter((t) => t.id === 'dep:build')
          .map((task) => ({ task, status: 'local-cache', code: 0 }))
      );

      await orchestrator.applyFromCacheOrRunBatch(
        true,
        { id: 'batch-1', executorName: 'my-plugin:batch', taskGraph },
        0
      );

      // dep (call 1) and consumer (call 2) — no post-execution re-hash needed
      expect(hasher.hashTasks).toHaveBeenCalledTimes(2);
      expect(consumer.hash).toBe('consumer:build|call-2');
    });
  });

  describe('cached failures (NX_CACHE_FAILURES)', () => {
    const originalCacheFailures = process.env.NX_CACHE_FAILURES;

    afterEach(() => {
      if (originalCacheFailures === undefined) {
        delete process.env.NX_CACHE_FAILURES;
      } else {
        process.env.NX_CACHE_FAILURES = originalCacheFailures;
      }
    });

    function createTask(id: string): Task {
      const [project, target] = id.split(':');
      return {
        id,
        target: { project, target },
        overrides: {},
        outputs: [],
        projectRoot: project,
        cache: true,
        parallelism: true,
        hash: `${id}-hash`,
      } as Task;
    }

    function createOrchestrator(batchResults: Map<string, any>) {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      orchestrator.cache = {
        getBatch: jest.fn(async () => batchResults),
        copyFilesFromCache: jest.fn(),
      };
      orchestrator.cacheMissedHashes = new Set();
      orchestrator.shouldCopyOutputsFromCacheBatch = jest.fn(
        async () => new Map()
      );
      orchestrator.options = {
        lifeCycle: { printTaskTerminalOutput: jest.fn() },
      };
      return orchestrator;
    }

    it('should not read failed results from cache by default', async () => {
      const passing = createTask('app:test');
      const failing = createTask('app:lint');
      const orchestrator = createOrchestrator(
        new Map([
          [passing.hash, { code: 0, terminalOutput: 'ok', remote: false }],
          [failing.hash, { code: 1, terminalOutput: 'boom', remote: false }],
        ])
      );
      delete process.env.NX_CACHE_FAILURES;

      const hits = await orchestrator.fetchCacheHits([passing, failing]);

      expect(hits.map((h: any) => h.task.id)).toEqual(['app:test']);
    });

    it('should read failed results from cache when NX_CACHE_FAILURES is enabled', async () => {
      const passing = createTask('app:test');
      const failing = createTask('app:lint');
      const orchestrator = createOrchestrator(
        new Map([
          [passing.hash, { code: 0, terminalOutput: 'ok', remote: false }],
          [failing.hash, { code: 1, terminalOutput: 'boom', remote: false }],
        ])
      );
      process.env.NX_CACHE_FAILURES = 'true';

      const hits = await orchestrator.fetchCacheHits([passing, failing]);

      expect(hits.map((h: any) => h.task.id)).toEqual(['app:test', 'app:lint']);
    });

    it('should report a cached failure as a failure, not a cache hit', async () => {
      const failing = createTask('app:lint');
      const orchestrator = createOrchestrator(new Map());

      const results = await orchestrator.finalizeCacheHits([
        {
          task: failing,
          cachedResult: { code: 1, terminalOutput: 'boom', remote: false },
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failure');
      expect(results[0].code).toBe(1);
      // The cached failure output is still surfaced to the user.
      expect(
        orchestrator.options.lifeCycle.printTaskTerminalOutput
      ).toHaveBeenCalledWith(failing, 'failure', 'boom');
    });
  });

  describe('cache miss memoization', () => {
    const originalCacheFailures = process.env.NX_CACHE_FAILURES;

    afterEach(() => {
      if (originalCacheFailures === undefined) {
        delete process.env.NX_CACHE_FAILURES;
      } else {
        process.env.NX_CACHE_FAILURES = originalCacheFailures;
      }
    });

    function createTask(id: string): Task {
      const [project, target] = id.split(':');
      return {
        id,
        target: { project, target },
        overrides: {},
        outputs: [],
        projectRoot: project,
        cache: true,
        parallelism: true,
        hash: `${id}-hash`,
      } as Task;
    }

    function createOrchestrator(batchResults: Map<string, any>) {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      orchestrator.cache = {
        getBatch: jest.fn(async () => batchResults),
      };
      orchestrator.cacheMissedHashes = new Set();
      return orchestrator;
    }

    it('should not re-query hashes already confirmed as misses', async () => {
      const task = createTask('app:build');
      const orchestrator = createOrchestrator(new Map());

      expect(await orchestrator.fetchCacheHits([task])).toEqual([]);
      expect(await orchestrator.fetchCacheHits([task])).toEqual([]);

      expect(orchestrator.cache.getBatch).toHaveBeenCalledTimes(1);
    });

    it('should only query hashes not yet confirmed as misses', async () => {
      const hit = createTask('app:test');
      const miss = createTask('app:build');
      const orchestrator = createOrchestrator(
        new Map([[hit.hash, { code: 0, terminalOutput: 'ok', remote: false }]])
      );

      const firstHits = await orchestrator.fetchCacheHits([hit, miss]);
      expect(firstHits.map((h: any) => h.task.id)).toEqual(['app:test']);

      const secondHits = await orchestrator.fetchCacheHits([hit, miss]);
      expect(secondHits.map((h: any) => h.task.id)).toEqual(['app:test']);
      expect(orchestrator.cache.getBatch).toHaveBeenLastCalledWith([hit]);
    });

    it('should memoize cached failures as misses when they are not replayable', async () => {
      const failing = createTask('app:lint');
      const orchestrator = createOrchestrator(
        new Map([
          [failing.hash, { code: 1, terminalOutput: 'boom', remote: false }],
        ])
      );
      delete process.env.NX_CACHE_FAILURES;

      await orchestrator.fetchCacheHits([failing]);
      await orchestrator.fetchCacheHits([failing]);

      expect(orchestrator.cache.getBatch).toHaveBeenCalledTimes(1);
    });

    it('should not memoize replayable cached failures when NX_CACHE_FAILURES is enabled', async () => {
      const failing = createTask('app:lint');
      const orchestrator = createOrchestrator(
        new Map([
          [failing.hash, { code: 1, terminalOutput: 'boom', remote: false }],
        ])
      );
      process.env.NX_CACHE_FAILURES = 'true';

      const hits = await orchestrator.fetchCacheHits([failing]);

      expect(hits.map((h: any) => h.task.id)).toEqual(['app:lint']);
      expect(orchestrator.cacheMissedHashes.has(failing.hash)).toBe(false);
    });

    it('should re-query a task after it is re-hashed to a new hash', async () => {
      const task = createTask('app:build');
      const orchestrator = createOrchestrator(new Map());

      await orchestrator.fetchCacheHits([task]);
      task.hash = 'app:build-rehash';
      await orchestrator.fetchCacheHits([task]);

      expect(orchestrator.cache.getBatch).toHaveBeenCalledTimes(2);
      expect(orchestrator.cache.getBatch).toHaveBeenLastCalledWith([task]);
    });

    it('should skip bulk resolution entirely when every scheduled task is a known miss', async () => {
      const task = createTask('app:build');
      const orchestrator = createOrchestrator(new Map());
      orchestrator.taskGraph = { tasks: { 'app:build': task } };
      orchestrator.tasksSchedule = {
        getAllScheduledTasks: () => ({ scheduledTasks: ['app:build'] }),
      };
      orchestrator.processedTasks = new Map();
      orchestrator.groups = [];
      orchestrator.options = {
        parallel: 3,
        lifeCycle: { scheduleTask: jest.fn() },
      };

      expect(await orchestrator.resolveCachedTasksBulk()).toBe(false);
      expect(orchestrator.cache.getBatch).toHaveBeenCalledTimes(1);

      expect(await orchestrator.resolveCachedTasksBulk()).toBe(false);
      expect(orchestrator.cache.getBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('printGroupedBatchOutput', () => {
    const originalGithubActions = process.env.GITHUB_ACTIONS;
    const originalSkip = process.env.NX_SKIP_LOG_GROUPING;
    const originalStream = process.env.NX_STREAM_OUTPUT;

    beforeEach(() => {
      // Put shouldGroupBatchOutput() into its folding state.
      process.env.GITHUB_ACTIONS = 'true';
      delete process.env.NX_SKIP_LOG_GROUPING;
      delete process.env.NX_STREAM_OUTPUT;
    });

    afterEach(() => {
      process.env.GITHUB_ACTIONS = originalGithubActions;
      process.env.NX_SKIP_LOG_GROUPING = originalSkip;
      process.env.NX_STREAM_OUTPUT = originalStream;
    });

    function makeTask(id: string): Task {
      const [project, target] = id.split(':');
      return {
        id,
        target: { project, target },
        overrides: { __overrides_unparsed__: [] },
        outputs: [],
        parallelism: true,
      } as Partial<Task> as Task;
    }

    function createOrchestrator() {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      orchestrator.options = {
        lifeCycle: { printTaskTerminalOutput: jest.fn() },
      };
      // Object.create bypasses field initializers.
      orchestrator.batchFailureGroupCount = 0;
      return orchestrator;
    }

    function captureStdout(cb: () => void): string {
      const original = process.stdout.write;
      let out = '';
      process.stdout.write = ((chunk: any) => {
        out += chunk;
        return true;
      }) as any;
      try {
        cb();
      } finally {
        process.stdout.write = original;
      }
      return stripVTControlCharacters(out);
    }

    it('renders a successful batch as per-task folds, not a batch fold', () => {
      const orchestrator = createOrchestrator();
      const a = makeTask('a:build');
      const b = makeTask('b:build');
      const taskResults = [
        { task: a, status: 'success', code: 0, terminalOutput: 'a body' },
        { task: b, status: 'local-cache', code: 0, terminalOutput: 'b body' },
      ];

      const out = captureStdout(() =>
        orchestrator.printGroupedBatchOutput(
          { id: 'batch', executorName: '@nx/js:tsc', taskGraph: {} },
          taskResults,
          'captured build log that should be ignored on success'
        )
      );

      const print = orchestrator.options.lifeCycle.printTaskTerminalOutput;
      expect(print).toHaveBeenCalledTimes(2);
      expect(print).toHaveBeenCalledWith(a, 'success', 'a body');
      expect(print).toHaveBeenCalledWith(b, 'local-cache', 'b body');
      // The captured buffer is for failures only.
      expect(out).not.toContain('captured build log');
      expect(out).not.toContain('batch @nx/js:tsc');
    });

    it('renders a failed batch as one fold carrying the captured output', () => {
      const orchestrator = createOrchestrator();
      const a = makeTask('a:build');
      const b = makeTask('b:build');
      const taskResults = [
        { task: a, status: 'success', code: 0, terminalOutput: 'a body' },
        { task: b, status: 'failure', code: 1, terminalOutput: 'b body' },
      ];

      const out = captureStdout(() =>
        orchestrator.printGroupedBatchOutput(
          { id: 'batch', executorName: '@nx/gradle:batch', taskGraph: {} },
          taskResults,
          'OutOfMemoryError: whole-batch diagnostic no task claimed'
        )
      );

      // One fold, labelled with the executor and a run-unique id, carrying the
      // diagnostic that no task's terminalOutput held.
      expect(out).toContain('::group::');
      expect(out).toContain('@nx/gradle:batch batch #1');
      expect(out).toContain('OutOfMemoryError: whole-batch diagnostic');
      expect(out).toContain('::endgroup::');
      // Each task points at the group instead of re-printing its output.
      expect(out).toContain('nx run a:build');
      expect(out).toContain('nx run b:build');
      expect(out).toContain('(output in "@nx/gradle:batch batch #1" above)');
      // Not re-printed as per-task folds.
      expect(
        orchestrator.options.lifeCycle.printTaskTerminalOutput
      ).not.toHaveBeenCalled();
    });

    it('gives each failed batch a distinct id', () => {
      const orchestrator = createOrchestrator();
      const results = [
        { task: makeTask('a:build'), status: 'failure', code: 1 },
      ];

      const out = captureStdout(() => {
        orchestrator.printGroupedBatchOutput(
          { executorName: '@nx/js:tsc' },
          results,
          'first crash'
        );
        orchestrator.printGroupedBatchOutput(
          { executorName: '@nx/js:tsc' },
          results,
          'second crash'
        );
      });

      expect(out).toContain('@nx/js:tsc batch #1');
      expect(out).toContain('@nx/js:tsc batch #2');
    });
  });
});
