import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { stripVTControlCharacters } from 'util';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { TaskOrchestrator } from './task-orchestrator';

performance.mark = vi.fn((name: string) => ({ name }) as PerformanceMark);
performance.measure = vi.fn();

vi.mock('./task-env', async () => ({
  ...(await vi.importActual('./task-env')),
  getTaskSpecificEnv: vi.fn(() => process.env),
}));

vi.mock('./utils', async () => ({
  ...(await vi.importActual('./utils')),
  getCustomHasher: vi.fn(() => null),
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
        hashTasks: vi.fn(async (tasks: Task[]) => {
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
      orchestrator.options = { lifeCycle: { scheduleTask: vi.fn() } };
      orchestrator.forkedProcessTaskRunner = {
        cleanUpBatchProcesses: vi.fn(),
      };
      orchestrator.applyCachedResults = vi.fn().mockResolvedValue([]);
      orchestrator.preRunSteps = vi.fn();
      const hashesAtCacheTime: Record<string, string> = {};
      orchestrator.postRunSteps = vi.fn(async (results: any[]) => {
        for (const r of results) {
          hashesAtCacheTime[r.task.id] = r.task.hash;
          orchestrator.completedTasks.set(r.task.id, r.status);
        }
      });
      orchestrator.runBatch = vi.fn(async (batch: any) =>
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
      orchestrator.applyCachedResults = vi.fn(async (tasks: Task[]) =>
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
        getBatch: vi.fn(async () => batchResults),
        copyFilesFromCache: vi.fn(),
      };
      orchestrator.cacheMissedHashes = new Set();
      orchestrator.shouldCopyOutputsFromCacheBatch = vi.fn(
        async () => new Map()
      );
      orchestrator.options = {
        lifeCycle: { printTaskTerminalOutput: vi.fn() },
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
        getBatch: vi.fn(async () => batchResults),
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
        lifeCycle: { scheduleTask: vi.fn() },
      };

      expect(await orchestrator.resolveCachedTasksBulk()).toBe(false);
      expect(orchestrator.cache.getBatch).toHaveBeenCalledTimes(1);

      expect(await orchestrator.resolveCachedTasksBulk()).toBe(false);
      expect(orchestrator.cache.getBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('terminal output persistence', () => {
    let terminalOutputsDir: string;
    let originalCacheFailures: string | undefined;

    beforeEach(() => {
      terminalOutputsDir = mkdtempSync(join(tmpdir(), 'nx-terminal-outputs-'));
      // These tests assert that a FAILED task is not cached, which is only true
      // while `NX_CACHE_FAILURES` is off - `shouldCacheTaskResult` returns true
      // for any code when it is set. Reading it from the ambient environment
      // makes the outcome depend on whatever else ran first: this suite passes
      // locally and fails in CI, where something sets it. State it here rather
      // than inherit it.
      originalCacheFailures = process.env.NX_CACHE_FAILURES;
      delete process.env.NX_CACHE_FAILURES;
    });

    afterEach(() => {
      rmSync(terminalOutputsDir, { recursive: true, force: true });
      if (originalCacheFailures === undefined) {
        delete process.env.NX_CACHE_FAILURES;
      } else {
        process.env.NX_CACHE_FAILURES = originalCacheFailures;
      }
    });

    function makeTask(id: string, overrides: Partial<Task> = {}): Task {
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
        ...overrides,
      } as Task;
    }

    function createOrchestrator() {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      // Object.create bypasses field initializers.
      orchestrator.tasksWithPersistedOutput = new Set<string>();
      orchestrator.stopRequested = false;
      orchestrator.cache = {
        temporaryOutputPath: (task: Task) =>
          join(terminalOutputsDir, task.hash),
        put: jest.fn(async (task: Task, terminalOutput: string) => {
          // The real cache writes the same file this backstop targets.
          writeFileSync(join(terminalOutputsDir, task.hash), terminalOutput);
        }),
        recordTerminalOutputs: jest.fn(),
      };
      orchestrator.recordOutputsHashBatch = jest.fn();
      orchestrator.complete = jest.fn();
      orchestrator.scheduleNextTasksAndReleaseThreads = jest.fn();
      return orchestrator;
    }

    function readOutput(task: Task): string | null {
      const path = join(terminalOutputsDir, task.hash);
      return existsSync(path) ? readFileSync(path, 'utf-8') : null;
    }

    it('writes the terminal output of an uncacheable task', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build', { cache: false });

      await orchestrator.postRunSteps(
        [{ task, status: 'success', terminalOutput: 'batch body' }],
        true,
        0
      );

      expect(readOutput(task)).toBe('batch body');
      expect(orchestrator.cache.put).not.toHaveBeenCalled();
    });

    it('writes the terminal output of a failed cacheable task', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:test');

      await orchestrator.postRunSteps(
        [{ task, status: 'failure', terminalOutput: 'assertion failed' }],
        true,
        0
      );

      // Failures aren't cached (without NX_CACHE_FAILURES), so the cache would
      // never have written this one.
      expect(orchestrator.cache.put).not.toHaveBeenCalled();
      expect(readOutput(task)).toBe('assertion failed');
    });

    it('writes the terminal output of a stopped task', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build');

      await orchestrator.postRunSteps(
        [{ task, status: 'stopped', terminalOutput: 'partial output' }],
        true,
        0
      );

      expect(readOutput(task)).toBe('partial output');
    });

    it('leaves the write to the cache when the task is cached', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build');
      const writes: string[] = [];
      orchestrator.cache.put = jest.fn(
        async (t: Task, terminalOutput: string) => {
          writes.push(terminalOutput);
          writeFileSync(join(terminalOutputsDir, t.hash), terminalOutput);
        }
      );

      await orchestrator.postRunSteps(
        [{ task, status: 'success', terminalOutput: 'cached body' }],
        true,
        0
      );

      // Written once, by the cache — not twice.
      expect(writes).toEqual(['cached body']);
      expect(readOutput(task)).toBe('cached body');
      expect(orchestrator.tasksWithPersistedOutput.has(task.id)).toBe(false);
    });

    it('does not rewrite output a runner already persisted', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build', { cache: false });
      // The runner wrote the real PTY bytes when the process exited.
      writeFileSync(join(terminalOutputsDir, task.hash), 'from the runner');
      orchestrator.tasksWithPersistedOutput.add(task.id);

      await orchestrator.postRunSteps(
        [{ task, status: 'success', terminalOutput: 'from the result' }],
        true,
        0
      );

      expect(readOutput(task)).toBe('from the runner');
    });

    it('does not rewrite output replayed from the cache', async () => {
      const orchestrator = createOrchestrator();
      const local = makeTask('app:build');
      const remote = makeTask('app:test');

      await orchestrator.postRunSteps(
        [
          { task: local, status: 'local-cache', terminalOutput: 'replayed' },
          { task: remote, status: 'remote-cache', terminalOutput: 'replayed' },
        ],
        false,
        0
      );

      // The replayed output was read from these very files.
      expect(readOutput(local)).toBeNull();
      expect(readOutput(remote)).toBeNull();
    });

    it('writes nothing for a skipped task', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build', { cache: false });

      await orchestrator.postRunSteps(
        [{ task, status: 'skipped', terminalOutput: '' }],
        true,
        0
      );

      expect(readOutput(task)).toBeNull();
    });

    it('writes nothing when the result carries no terminal output', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build', { cache: false });

      await orchestrator.postRunSteps([{ task, status: 'success' }], true, 0);

      expect(readOutput(task)).toBeNull();
    });

    it('registers an uncacheable output with the cache so the GC can collect it', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build', { cache: false });

      await orchestrator.postRunSteps(
        [{ task, status: 'success', terminalOutput: 'batch body' }],
        true,
        0
      );

      expect(orchestrator.cache.recordTerminalOutputs).toHaveBeenCalledWith([
        { hash: task.hash, size: 'batch body'.length },
      ]);
    });

    it('registers output a runner wrote, which the GC cannot see either', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build', { cache: false });
      writeFileSync(join(terminalOutputsDir, task.hash), 'from the runner');
      orchestrator.tasksWithPersistedOutput.add(task.id);

      await orchestrator.postRunSteps(
        [{ task, status: 'success', terminalOutput: 'from the runner' }],
        true,
        0
      );

      // Skipping the write must not skip the bookkeeping.
      expect(orchestrator.cache.recordTerminalOutputs).toHaveBeenCalledWith([
        { hash: task.hash, size: 'from the runner'.length },
      ]);
    });

    it('does not register output the cache recorded itself', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build');

      await orchestrator.postRunSteps(
        [{ task, status: 'success', terminalOutput: 'cached body' }],
        true,
        0
      );

      expect(orchestrator.cache.put).toHaveBeenCalled();
      expect(orchestrator.cache.recordTerminalOutputs).not.toHaveBeenCalled();
    });

    it('does not register output replayed from the cache', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build');

      await orchestrator.postRunSteps(
        [{ task, status: 'local-cache', terminalOutput: 'replayed' }],
        false,
        0
      );

      // That hash is already recorded — it is what the replay read.
      expect(orchestrator.cache.recordTerminalOutputs).not.toHaveBeenCalled();
    });

    it('registers a cacheable task run with --skip-nx-cache', async () => {
      const orchestrator = createOrchestrator();
      const task = makeTask('app:build');

      // shouldCache false is how --skip-nx-cache reaches postRunSteps: the
      // output lands on disk but no artifacts do.
      await orchestrator.postRunSteps(
        [{ task, status: 'success', terminalOutput: 'uncached body' }],
        false,
        0
      );

      expect(readOutput(task)).toBe('uncached body');
      expect(orchestrator.cache.put).not.toHaveBeenCalled();
      expect(orchestrator.cache.recordTerminalOutputs).toHaveBeenCalledWith([
        { hash: task.hash, size: 'uncached body'.length },
      ]);
    });

    it('writes every task of a batch that could not be cached', async () => {
      const orchestrator = createOrchestrator();
      const a = makeTask('a:build', { cache: false });
      const b = makeTask('b:build', { cache: false });

      await orchestrator.postRunSteps(
        [
          { task: a, status: 'success', terminalOutput: 'a body' },
          { task: b, status: 'failure', terminalOutput: 'b body' },
        ],
        true,
        0
      );

      expect(readOutput(a)).toBe('a body');
      expect(readOutput(b)).toBe('b body');
    });
  });

  describe('printGroupedBatchOutput', () => {
    // Restoring by assignment would set the string "undefined" for anything
    // that was unset, which is truthy - leaving isLogGroupingEnabled() true for
    // the rest of the worker. withEnvironmentVariables deletes properly.
    let restoreEnv: () => void;
    beforeEach(() => {
      // Put shouldGroupBatchOutput() into its folding state.
      const saved = {
        GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
        NX_SKIP_LOG_GROUPING: process.env.NX_SKIP_LOG_GROUPING,
        NX_STREAM_OUTPUT: process.env.NX_STREAM_OUTPUT,
      };
      process.env.GITHUB_ACTIONS = 'true';
      delete process.env.NX_SKIP_LOG_GROUPING;
      delete process.env.NX_STREAM_OUTPUT;
      restoreEnv = () => {
        for (const [key, value] of Object.entries(saved)) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
      };
    });

    afterEach(() => restoreEnv());

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

    function createOrchestrator(
      args: { verbose?: boolean; outputStyle?: string } = {}
    ) {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      orchestrator.options = {
        lifeCycle: { printTaskTerminalOutput: vi.fn() },
        verbose: args.verbose,
      };
      // Mirrors the real construction: the style is its own constructor
      // argument, sourced from `nxArgs`, while `options` is the merged runner
      // options object. Putting the style in `options` here would let a read of
      // the wrong one pass.
      // Mirrors the two constructor fields: what the user named, and what the
      // run renders with. A fixture that set only one would let a read of the
      // wrong field pass.
      orchestrator.specifiedOutputStyle = args.outputStyle;
      orchestrator.resolvedOutputStyle =
        args.outputStyle ?? 'static-failures-only';
      // Object.create bypasses field initializers.
      orchestrator.batchFoldRenders = new Map();
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

    const BATCH = {
      id: '@nx/js:tsc 1',
      executorName: '@nx/js:tsc',
      taskGraph: {},
    };

    /** The batch's captured worker log, which only a full-output run renders. */
    let capturedOutputDir: string;
    beforeEach(() => {
      capturedOutputDir = mkdtempSync(join(tmpdir(), 'nx-batch-output-'));
    });
    afterEach(() => {
      rmSync(capturedOutputDir, { recursive: true, force: true });
    });
    function capturedOutputFile(contents: string): string {
      const path = join(capturedOutputDir, `captured-${contents.length}.log`);
      writeFileSync(path, contents);
      return path;
    }

    it('copies a fold body larger than one read buffer without corrupting it', () => {
      const orchestrator = createOrchestrator({ outputStyle: 'static' });
      const a = makeTask('a:build');
      // Well past the 64 KB read buffer, and distinguishable per line so a
      // reordered or duplicated chunk cannot hash the same.
      const body =
        Array.from({ length: 40000 }, (_, i) =>
          `line ${i}`.padEnd(31, '.')
        ).join('\n') + '\n';

      // A backed-up pipe holds each Buffer it was handed and reads it later.
      // Concatenating on write would copy, and hide the bug being tested.
      const original = process.stdout.write;
      const queued: Buffer[] = [];
      process.stdout.write = ((chunk: any) => {
        queued.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        );
        return true;
      }) as any;
      try {
        orchestrator.printGroupedBatchOutput(
          BATCH,
          [{ task: a, status: 'success', code: 0, terminalOutput: '' }],
          capturedOutputFile(body)
        );
      } finally {
        process.stdout.write = original;
      }

      expect(Buffer.concat(queued).toString()).toContain(body);
    });

    it('renders a batch that reported results from each task, never as a batch fold', async () => {
      const orchestrator = createOrchestrator();
      const a = makeTask('a:build');
      const b = makeTask('b:build');
      const taskResults = [
        { task: a, status: 'success', code: 0, terminalOutput: 'a body' },
        { task: b, status: 'local-cache', code: 0, terminalOutput: 'b body' },
      ];

      const out = await captureStdout(() =>
        orchestrator.printGroupedBatchOutput(BATCH, taskResults, undefined)
      );

      const print = orchestrator.options.lifeCycle.printTaskTerminalOutput;
      expect(print).toHaveBeenCalledTimes(2);
      expect(print).toHaveBeenCalledWith(a, 'success', 'a body');
      expect(print).toHaveBeenCalledWith(b, 'local-cache', 'b body');
      expect(out).not.toContain('batch @nx/js:tsc');
    });

    it('renders a FAILED batch per task when nothing was captured', async () => {
      const orchestrator = createOrchestrator();
      const a = makeTask('a:build');
      const b = makeTask('b:build');
      const taskResults = [
        { task: a, status: 'success', code: 0, terminalOutput: 'a body' },
        { task: b, status: 'failure', code: 1, terminalOutput: 'b failed' },
      ];

      const out = await captureStdout(() =>
        orchestrator.printGroupedBatchOutput(BATCH, taskResults, undefined)
      );

      // With no captured log there is nothing a fold could add, so each task
      // renders itself. This is the no-capture case only - see the test below
      // for what happens when the worker did leave a log behind.
      const print = orchestrator.options.lifeCycle.printTaskTerminalOutput;
      expect(print).toHaveBeenCalledWith(b, 'failure', 'b failed');
      expect(print).toHaveBeenCalledWith(a, 'success', 'a body');
      expect(out).not.toContain('batch @nx/js:tsc');
    });

    it.each([['failure'], ['stopped']])(
      'folds a batch with a %s task on the failures-only default, so a diagnostic no task claimed survives',
      async (badStatus) => {
        const orchestrator = createOrchestrator();
        const a = makeTask('a:build');
        const b = makeTask('b:build');
        const taskResults = [
          { task: a, status: 'success', code: 0, terminalOutput: 'a body' },
          {
            task: b,
            status: badStatus,
            code: 1,
            terminalOutput: 'Error: gradlew batch failed',
          },
        ];

        const out = await captureStdout(() =>
          orchestrator.printGroupedBatchOutput(
            BATCH,
            taskResults,
            capturedOutputFile(
              'FAILURE: Could not determine java version\ncompile error detail'
            )
          )
        );

        // `@nx/maven` and `@nx/gradle` catch their own crash and backfill task
        // results, so the batch resolves and reaches this path. The bytes that
        // explain the failure are the ones they attributed to no task - a
        // config-phase error, an exit-code dump - and they exist only in the
        // captured log. Rendering per task here would delete the only copy.
        expect(out).toContain('FAILURE: Could not determine java version');
        expect(out).toContain('compile error detail');
        expect(out).toContain('batch @nx/js:tsc 1');
        // The fold carries what no task claimed; the per-task blocks carry the
        // attribution, and for some plugins output that is in no other place.
        const print = orchestrator.options.lifeCycle.printTaskTerminalOutput;
        expect(print).toHaveBeenCalledWith(a, 'success', 'a body');
        expect(print).toHaveBeenCalledWith(
          b,
          badStatus,
          'Error: gradlew batch failed'
        );
      }
    );

    it('never folds under --output-style=summary, even when a task failed', async () => {
      const orchestrator = createOrchestrator({ outputStyle: 'summary' });
      const a = makeTask('a:build');
      const b = makeTask('b:build');
      const taskResults = [
        { task: a, status: 'success', code: 0, terminalOutput: 'a body' },
        { task: b, status: 'failure', code: 1, terminalOutput: 'b failed' },
      ];

      const out = await captureStdout(() =>
        orchestrator.printGroupedBatchOutput(
          BATCH,
          taskResults,
          capturedOutputFile('the entire gradle build log')
        )
      );

      // summary addresses logs by path rather than printing them. The fold
      // bypasses the life cycle and writes to `output` directly, so without an
      // explicit check it would dump the whole worker log into exactly the run
      // that asked not to see it.
      expect(out).not.toContain('the entire gradle build log');
      expect(out).not.toContain('batch @nx/js:tsc');
      // The tasks still report themselves - the summary life cycle is what
      // turns that into a path.
      expect(
        orchestrator.options.lifeCycle.printTaskTerminalOutput
      ).toHaveBeenCalledWith(b, 'failure', 'b failed');
    });

    it('still collapses an all-green batch on the default, captured log or not', async () => {
      const orchestrator = createOrchestrator();
      const a = makeTask('a:build');
      const taskResults = [
        { task: a, status: 'success', code: 0, terminalOutput: 'a body' },
      ];

      const out = await captureStdout(() =>
        orchestrator.printGroupedBatchOutput(
          BATCH,
          taskResults,
          capturedOutputFile('noisy build chatter nobody asked for')
        )
      );

      // Folding on failure must not become folding always - the whole point of
      // the default is that a green batch stays quiet.
      expect(out).not.toContain('noisy build chatter nobody asked for');
      expect(out).not.toContain('batch @nx/js:tsc');
      expect(
        orchestrator.options.lifeCycle.printTaskTerminalOutput
      ).toHaveBeenCalledWith(a, 'success', 'a body');
    });

    it.each([
      ['--output-style=static', { outputStyle: 'static' }],
      ['--verbose', { verbose: true }],
    ])(
      'renders the whole batch log as one fold under %s',
      async (_name, args) => {
        const orchestrator = createOrchestrator(args);
        const a = makeTask('a:build');
        const taskResults = [
          { task: a, status: 'success', code: 0, terminalOutput: 'a body' },
        ];

        const out = await captureStdout(() =>
          orchestrator.printGroupedBatchOutput(
            BATCH,
            taskResults,
            capturedOutputFile('runner summary no task claimed')
          )
        );

        // A full-output run wants everything the batch emitted, including the
        // bytes no task attributed to itself.
        expect(out).toContain('runner summary no task claimed');
        expect(out).toContain('batch @nx/js:tsc 1');
        // And the tasks still render themselves. Letting the fold stand in for
        // them drops anything a plugin reports without writing to stdio.
        expect(
          orchestrator.options.lifeCycle.printTaskTerminalOutput
        ).toHaveBeenCalledWith(a, 'success', 'a body');
        // Nothing to redirect to when every task prints its own block.
        expect(out).not.toContain('output in "batch @nx/js:tsc 1" above');
      }
    );

    it('skips tasks that never dispatched', async () => {
      const orchestrator = createOrchestrator();
      const a = makeTask('a:build');
      const taskResults = [
        { task: a, status: 'skipped', code: 1, terminalOutput: '' },
      ];

      await captureStdout(() =>
        orchestrator.printGroupedBatchOutput(BATCH, taskResults, undefined)
      );

      expect(
        orchestrator.options.lifeCycle.printTaskTerminalOutput
      ).not.toHaveBeenCalled();
    });
  });

  describe('runBatch failure folds', () => {
    // Restoring by assignment would set the string "undefined" for anything
    // that was unset, which is truthy - leaving isLogGroupingEnabled() true for
    // the rest of the worker. withEnvironmentVariables deletes properly.
    let restoreEnv: () => void;
    beforeEach(() => {
      // Put shouldGroupBatchOutput() into its folding state.
      const saved = {
        GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
        NX_SKIP_LOG_GROUPING: process.env.NX_SKIP_LOG_GROUPING,
        NX_STREAM_OUTPUT: process.env.NX_STREAM_OUTPUT,
      };
      process.env.GITHUB_ACTIONS = 'true';
      delete process.env.NX_SKIP_LOG_GROUPING;
      delete process.env.NX_STREAM_OUTPUT;
      restoreEnv = () => {
        for (const [key, value] of Object.entries(saved)) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
      };
    });

    afterEach(() => restoreEnv());

    const EXIT_ERROR = '"@nx/gradle:batch" exited unexpectedly with code: 137';

    let capturedOutputDir: string;
    beforeEach(() => {
      capturedOutputDir = mkdtempSync(join(tmpdir(), 'nx-batch-runbatch-'));
    });
    afterEach(() => {
      rmSync(capturedOutputDir, { recursive: true, force: true });
    });

    function capturedPath(contents: string): string {
      const path = join(capturedOutputDir, 'captured.log');
      writeFileSync(path, contents);
      return path;
    }

    function createOrchestrator(captured: string, stopRequested: boolean) {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      orchestrator.options = {
        lifeCycle: {
          printTaskTerminalOutput: vi.fn(),
          appendTaskOutput: vi.fn(),
          setTaskStatus: vi.fn(),
        },
      };
      // Object.create bypasses field initializers.
      orchestrator.batchFoldRenders = new Map();
      orchestrator.stopRequested = stopRequested;
      orchestrator.projectGraph = {} as ProjectGraph;
      orchestrator.taskGraph = {
        tasks: {
          'a:build': {
            id: 'a:build',
            target: { project: 'a', target: 'build' },
            overrides: { __overrides_unparsed__: [] },
            outputs: [],
            parallelism: true,
          } as Partial<Task> as Task,
        },
      } as Partial<TaskGraph> as TaskGraph;
      orchestrator.fullTaskGraph = orchestrator.taskGraph;
      // Read through a mutable field so a single orchestrator can render two
      // batches with different bodies - which is what makes the fold-count map
      // key load-bearing in `labels each fold with the batch it came from`.
      orchestrator.capturedForTest = captured;
      orchestrator.forkedProcessTaskRunner = {
        forkProcessForBatch: vi.fn().mockResolvedValue({
          onOutput: vi.fn(),
          onTaskResults: vi.fn(),
          getResults: vi.fn().mockRejectedValue(new Error(EXIT_ERROR)),
          getCapturedOutputPath: () =>
            orchestrator.capturedForTest
              ? capturedPath(orchestrator.capturedForTest)
              : undefined,
          discardCapturedOutput: () => {},
        }),
      };
      return orchestrator;
    }

    async function captureStdout(cb: () => Promise<unknown>): Promise<string> {
      const original = process.stdout.write;
      let out = '';
      process.stdout.write = ((chunk: any) => {
        out += chunk;
        return true;
      }) as any;
      try {
        await cb();
      } finally {
        process.stdout.write = original;
      }
      return stripVTControlCharacters(out);
    }

    const batch = {
      id: '@nx/gradle:batch 1',
      executorName: '@nx/gradle:batch',
      taskGraph: { tasks: { 'a:build': {} } },
    };

    it("surfaces a crashed batch's captured log alongside the exit error", async () => {
      const orchestrator = createOrchestrator(
        'FAILURE: Could not resolve all dependencies',
        false
      );

      const out = await captureStdout(() =>
        orchestrator.runBatch(batch, {}, 0)
      );

      expect(out).toContain('batch @nx/gradle:batch 1');
      expect(out).toContain('FAILURE: Could not resolve all dependencies');
      expect(out).toContain(EXIT_ERROR);
    });

    it("surfaces a stopped batch's captured log, without the exit error", async () => {
      const orchestrator = createOrchestrator(
        'gradle: still resolving dependencies',
        true
      );

      const out = await captureStdout(() =>
        orchestrator.runBatch(batch, {}, 0)
      );

      // The partial log is the only thing that shows where an interrupted
      // batch hung, and grouping means nothing streamed live.
      expect(out).toContain('batch @nx/gradle:batch 1');
      expect(out).toContain('gradle: still resolving dependencies');
      // The exit code just restates the cancellation.
      expect(out).not.toContain(EXIT_ERROR);
    });

    it('disambiguates two folds rendered for the same batch id', async () => {
      // A batch that reports a strict subset of its tasks is re-run under the
      // same id, so one id can render more than one fold.
      const orchestrator = createOrchestrator('first pass', false);

      const out = await captureStdout(async () => {
        await orchestrator.runBatch(batch, {}, 0);
        await orchestrator.runBatch(batch, {}, 0);
      });

      // Anchored on the redirect line, since a bare `batch @nx/gradle:batch 1`
      // is also a prefix of the second fold's label.
      expect(out).toContain('(output in "batch @nx/gradle:batch 1" above)');
      expect(out).toContain('batch @nx/gradle:batch 1:2');
      // Each task's redirect line has to name the fold it belongs to.
      expect(out).toContain('(output in "batch @nx/gradle:batch 1:2" above)');
    });

    it('labels each fold with the batch it came from', async () => {
      const second = { ...batch, id: '@nx/gradle:batch 2' };
      // One orchestrator, so both renders share the fold-count map. Two of them
      // would each start from an empty map and both count as the first render,
      // which passes whatever the map is keyed on - including the executor name
      // this test exists to rule out.
      const orchestrator = createOrchestrator('first crash', false);

      const out = await captureStdout(async () => {
        await orchestrator.runBatch(batch, {}, 0);
        orchestrator.capturedForTest = 'second crash';
        await orchestrator.runBatch(second, {}, 0);
      });

      // The same executor can crash more than once in a run, so the label has to
      // carry the batch's own id rather than a count of folds rendered.
      expect(out).toContain('batch @nx/gradle:batch 1');
      expect(out).toContain('batch @nx/gradle:batch 2');
      expect(out).toContain('first crash');
      expect(out).toContain('second crash');
      expect(out).toContain('(output in "batch @nx/gradle:batch 2" above)');
      // Keyed per executor instead, the second batch would render as a re-run
      // of the first.
      expect(out).not.toContain('batch @nx/gradle:batch 2:2');
    });
  });
});
