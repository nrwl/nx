import { join } from 'path';
import { TempFs } from '../internal-testing-utils/temp-fs';
import { retrieveWorkspaceFiles } from '../project-graph/utils/retrieve-workspace-files';
import { updateContextWithChangedFiles } from '../utils/workspace-context';
import {
  closeDbConnection,
  connectToNxDb,
  UltracacheConfigurationStore,
} from '../native';
import {
  createUltracacheRehasher,
  getUltracacheRehasher,
  exportUltracacheExecutionStates,
  captureUltracacheExecutionHash,
  InProcessTaskHasher,
} from './task-hasher';
import { linkSync, unlinkSync } from 'node:fs';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import type { InputDefinition } from '../config/workspace-json-project-json';

vi.mock('../tasks-runner/utils', async () => ({
  ...(await vi.importActual('../tasks-runner/utils')),
  getExecutorForTask: vi.fn(() => ({})),
}));

describe('Ultracache task rehashing', () => {
  let fs: TempFs;
  let db: ReturnType<typeof connectToNxDb>;
  const commit = 'a'.repeat(40);
  const configuration = (inputs: string[]) =>
    new UltracacheConfigurationStore(db).import({
      requestedCommit: commit,
      configurationsJson: JSON.stringify({ 'app:build': { commit, inputs } }),
    });

  beforeEach(async () => {
    exportUltracacheExecutionStates({});
    fs = new TempFs('ultracache-rehash');
    await fs.createFiles({
      'nx.json': '{}',
      'app/old.txt': 'old',
      'app/learned.txt': 'learned',
      'lib/source.txt': 'library',
      'tsconfig.base.json': '{"compilerOptions":{}}',
    });
    db = connectToNxDb(
      join(fs.tempDir, '.nx', 'workspace-data', 'configurations')
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    exportUltracacheExecutionStates({});
    closeDbConnection(db);
    fs.cleanup();
  });

  async function fixture(
    inputs: InputDefinition[] = ['{projectRoot}/old.txt', '^default'],
    graph?: ProjectGraph,
    activated = false
  ) {
    const projectGraph: ProjectGraph = graph ?? {
      nodes: {
        app: {
          name: 'app',
          type: 'lib',
          data: {
            root: 'app',
            targets: { build: { executor: 'nx:run-commands', inputs } },
          },
        },
        lib: {
          name: 'lib',
          type: 'lib',
          data: {
            root: 'lib',
            targets: { build: { executor: 'nx:run-commands' } },
          },
        },
      },
      dependencies: {
        app: [{ source: 'app', target: 'lib', type: 'static' }],
        lib: [],
      },
    };
    const graphTasks = Object.fromEntries(
      ['app', 'lib'].map((project) => [
        `${project}:build`,
        {
          id: `${project}:build`,
          cache: true,
          target: { project, target: 'build' },
          outputs: [`dist/${project}`],
          overrides: { argument: 'value', __overrides_unparsed__: ['ignored'] },
        },
      ])
    );
    const taskGraph: TaskGraph = {
      tasks: graphTasks,
      roots: ['lib:build'],
      dependencies: { 'app:build': [{ id: 'lib:build' }], 'lib:build': [] },
      continuousDependencies: {},
    };
    const files = await retrieveWorkspaceFiles(fs.tempDir, {
      app: 'app',
      lib: 'lib',
    });
    const hasher = new InProcessTaskHasher(
      projectGraph,
      {},
      files.rustReferences,
      {},
      undefined,
      activated
        ? new UltracacheConfigurationStore(db).import({
            requestedCommit: commit,
            configurationsJson: '{}',
          })
        : undefined
    );
    return {
      projectGraph,
      taskGraph,
      hasher,
      task: taskGraph.tasks['app:build'],
    };
  }

  it('equals a fresh invocation, retains TS command composition, and a changed learned input misses', async () => {
    const { hasher, taskGraph, task, projectGraph } = await fixture();
    const retained = createUltracacheRehasher(hasher)!;
    const original = await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    task.hash = original.value;
    // Simulate successful execution; configured outputs are deliberately unchanged.
    await fs.createFiles({ 'dist/app/result.txt': 'artifact' });
    const learned = configuration(['app/learned.txt']);
    const result = await retained.rehash(learned, { writtenFiles: [] });
    expect(result.skipped).toEqual({});
    expect(result.hashes[task.id]).not.toBe(original.value);
    const next = await fixture(undefined, projectGraph);
    const hash = await next.hasher.hashTask(
      next.task,
      next.taskGraph,
      {},
      fs.tempDir,
      false,
      learned
    );
    expect(result.hashes[task.id]).toBe(hash.value);
    expect(task.hash).toBe(original.value);
    expect(task.outputs).toEqual(['dist/app']);
    const changedCommand = {
      ...next.task,
      overrides: { argument: 'different' },
    };
    expect(
      (
        await next.hasher.hashTask(
          changedCommand,
          next.taskGraph,
          {},
          fs.tempDir,
          false,
          learned
        )
      ).value
    ).not.toBe(hash.value);
    fs.writeFile('app/learned.txt', 'changed');
    await updateContextWithChangedFiles(
      fs.tempDir,
      [],
      ['app/learned.txt'],
      []
    );
    const changed = await fixture(undefined, projectGraph);
    expect(
      (
        await changed.hasher.hashTask(
          changed.task,
          changed.taskGraph,
          {},
          fs.tempDir,
          false,
          learned
        )
      ).value
    ).not.toBe(hash.value);
    expect(
      (await retained.rehash(learned, { writtenFiles: [] })).skipped[task.id]
    ).toBe('source-changed');
    retained.dispose();
    expect(
      (await retained.rehash(learned, { writtenFiles: [] })).hashes
    ).toEqual({});
  });

  it('captures env values before execution instead of reading the post-task environment', async () => {
    const { hasher, taskGraph, task, projectGraph } = await fixture([
      '{projectRoot}/old.txt',
      { env: 'REHASH_ENV' },
    ]);
    const retained = createUltracacheRehasher(hasher)!;
    const env = { REHASH_ENV: 'before' };
    await hasher.hashTask(task, taskGraph, env, fs.tempDir);
    env.REHASH_ENV = 'after';
    const learned = configuration(['app/learned.txt']);
    const result = await retained.rehash(learned, { writtenFiles: [] });
    const next = await fixture(undefined, projectGraph);
    expect(result.hashes[task.id]).toBe(
      (
        await next.hasher.hashTask(
          task,
          taskGraph,
          { REHASH_ENV: 'before' },
          fs.tempDir,
          false,
          learned
        )
      ).value
    );
    expect(result.hashes[task.id]).not.toBe(
      (
        await next.hasher.hashTask(
          task,
          taskGraph,
          env,
          fs.tempDir,
          false,
          learned
        )
      ).value
    );
  });

  it.each([
    ['app/*.txt', 'missing-source-observation'],
    ['app/missing.txt', 'non-source-input'],
    ['dist/app/result.txt', 'non-source-input'],
  ])('skips unsupported learned input %s', async (input, reason) => {
    const { hasher, taskGraph, task } = await fixture();
    const retained = createUltracacheRehasher(hasher)!;
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    await fs.createFiles({ 'dist/app/result.txt': 'new generated file' });
    const result = await retained.rehash(configuration([input]), {
      writtenFiles: [],
    });
    expect(result.hashes).toEqual({});
    expect(result.skipped[task.id]).toBe(reason);
  });

  it.each([
    [{ runtime: 'echo before' }, 'runtime-input'],
    [{ dependentTasksOutputFiles: '**/*' }, 'dependency-output'],
    [{ json: '{projectRoot}/package.json', fields: ['name'] }, 'json-input'],
  ] as const)('never approximates live input %j', async (input, reason) => {
    await fs.createFiles({
      'app/package.json': '{"name":"before"}',
      'dist/lib/generated.txt': 'before',
    });
    const { hasher, taskGraph, task } = await fixture([
      '{projectRoot}/old.txt',
      input as InputDefinition,
    ]);
    const retained = createUltracacheRehasher(hasher)!;
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    await fs.createFiles({
      'app/package.json': '{"name":"after"}',
      'dist/lib/generated.txt': 'after',
    });
    const result = await retained.rehash(
      configuration(['app/learned.txt', 'app/package.json']),
      { writtenFiles: [] }
    );
    expect(result.hashes).toEqual({});
    expect(result.skipped[task.id]).toBe(reason);
  });

  it('supports ordinary source dependencies and rejects their post-task mutation', async () => {
    const { hasher, taskGraph, task, projectGraph } = await fixture();
    const retained = createUltracacheRehasher(hasher)!;
    const tasks = Object.values(taskGraph.tasks);
    await hasher.hashTasksUpfront(
      tasks,
      taskGraph,
      Object.fromEntries(tasks.map((t) => [t.id, {}])),
      fs.tempDir
    );
    const learned = configuration(['app/learned.txt', 'lib/source.txt']);
    const result = await retained.rehash(learned, { writtenFiles: [] });
    const next = await fixture(undefined, projectGraph);
    const hashes = await next.hasher.hashTasks(
      tasks,
      taskGraph,
      Object.fromEntries(tasks.map((t) => [t.id, {}])),
      fs.tempDir,
      false,
      learned
    );
    expect(result.hashes).toEqual(
      Object.fromEntries(tasks.map((t, i) => [t.id, hashes[i].value]))
    );
    fs.writeFile('lib/source.txt', 'mutated');
    const mutation = await retained.rehash(learned, { writtenFiles: [] });
    expect(mutation.hashes[task.id]).toBeUndefined();
    expect(mutation.skipped[task.id]).toBe('source-changed');
  });

  it('does not manufacture context for earlier hashes, proxies or custom hashers', async () => {
    const { hasher, taskGraph, task } = await fixture();
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    const retained = createUltracacheRehasher(hasher)!;
    expect(
      await retained.rehash(configuration(['app/learned.txt']), {
        writtenFiles: [],
      })
    ).toEqual({
      hashes: {},
      skipped: {},
    });
    expect(createUltracacheRehasher({} as any)).toBeNull();
  });

  it('rejects a learned source that is itself a declared output, even if tracked', async () => {
    const { hasher, taskGraph, task } = await fixture();
    task.outputs = ['app/learned.txt'];
    const retained = createUltracacheRehasher(hasher)!;
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    expect(
      (
        await retained.rehash(configuration(['app/learned.txt']), {
          writtenFiles: [],
        })
      ).skipped[task.id]
    ).toBe('generated-input');
  });

  it('rejects source symlinks and post-task deletion', async () => {
    fs.createSymlinkSync('app/learned.txt', 'app/link.txt', 'file');
    const { hasher, taskGraph, task } = await fixture();
    const retained = createUltracacheRehasher(hasher)!;
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    expect(
      (
        await retained.rehash(configuration(['app/link.txt']), {
          writtenFiles: [],
        })
      ).hashes
    ).toEqual({});
    fs.removeFileSync('app/learned.txt');
    expect(
      (
        await retained.rehash(configuration(['app/learned.txt']), {
          writtenFiles: [],
        })
      ).hashes
    ).toEqual({});
  });

  it('retains the original configuration version while importing a complete replacement', async () => {
    const { hasher, taskGraph, task, projectGraph } = await fixture();
    const old = configuration(['app/old.txt']);
    // Back-to-back imports may share the store's millisecond version key.
    // The exact imported handles, rather than a plan memo keyed by time, win.
    const learned = configuration(['app/learned.txt', 'lib/source.txt']);
    const retained = createUltracacheRehasher(hasher)!;
    const original = await hasher.hashTask(
      task,
      taskGraph,
      {},
      fs.tempDir,
      false,
      old
    );
    const result = await retained.rehash(learned, { writtenFiles: [] });
    const next = await fixture(undefined, projectGraph);
    expect(result.hashes[task.id]).toBe(
      (
        await next.hasher.hashTask(
          task,
          taskGraph,
          {},
          fs.tempDir,
          false,
          learned
        )
      ).value
    );
    expect(result.hashes[task.id]).not.toBe(original.value);
  });

  it('rejects changed tsconfig bytes and never refreshes its held snapshot', async () => {
    const { hasher, taskGraph, task } = await fixture();
    const retained = createUltracacheRehasher(hasher)!;
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    fs.writeFile('tsconfig.base.json', '{"compilerOptions":{"strict":true}}');
    const result = await retained.rehash(configuration(['app/learned.txt']), {
      writtenFiles: [],
    });
    expect(result.hashes).toEqual({});
    expect(result.skipped[task.id]).toBe('source-changed');
  });

  it.each(['off', 'warn', 'error'] as const)(
    'does not promote mode %s',
    async (mode) => {
      const { hasher, taskGraph, task } = await fixture();
      task.ultracache = { mode };
      const retained = createUltracacheRehasher(hasher)!;
      await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
      expect(
        (
          await retained.rehash(configuration(['app/learned.txt']), {
            writtenFiles: [],
          })
        ).skipped[task.id]
      ).toBe('disabled');
    }
  );

  it('capture failure leaves normal hashing working and withholds promotion', async () => {
    const { hasher, taskGraph, task } = await fixture();
    const retained = createUltracacheRehasher(hasher)!;
    (task as any).pluginCallback = () => {};
    await expect(
      hasher.hashTask(task, taskGraph, {}, fs.tempDir)
    ).resolves.toHaveProperty('value');
    expect(
      (
        await retained.rehash(configuration(['app/learned.txt']), {
          writtenFiles: [],
        })
      ).hashes
    ).toEqual({});
    retained.dispose();
    const second = createUltracacheRehasher(hasher)!;
    retained.dispose(); // An old handle must not disable a newer one.
    delete (task as any).pluginCallback;
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    expect(
      (
        await second.rehash(configuration(['app/learned.txt']), {
          writtenFiles: [],
        })
      ).hashes[task.id]
    ).toBeDefined();
  });

  it('requires complete write evidence and rejects a temporary source rewrite even after restoration', async () => {
    const { hasher, taskGraph, task } = await fixture();
    const retained = createUltracacheRehasher(hasher)!;
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    fs.writeFile('app/learned.txt', 'read during execution');
    fs.writeFile('app/learned.txt', 'learned');
    const learned = configuration(['app/learned.txt']);
    expect(
      (await retained.rehash(learned, undefined as any)).skipped[task.id]
    ).toBe('missing-write-evidence');
    expect(
      (await retained.rehash(learned, { writtenFiles: ['app/learned.txt'] }))
        .skipped[task.id]
    ).toBe('input-written');
    expect(
      (await retained.rehash(learned, { writtenFiles: ['app'] })).hashes
    ).toEqual({});
  });

  it('captures in-place graph settings changes between hashing calls', async () => {
    const { hasher, taskGraph, task, projectGraph } = await fixture();
    const retained = createUltracacheRehasher(hasher)!;
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    task.ultracache = { collectStats: true };
    await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    const learned = configuration(['app/learned.txt']);
    const result = await retained.rehash(learned, { writtenFiles: [] });
    const next = await fixture(undefined, projectGraph);
    next.task.ultracache = { collectStats: true };
    expect(result.hashes[task.id]).toBe(
      (
        await next.hasher.hashTask(
          next.task,
          next.taskGraph,
          {},
          fs.tempDir,
          false,
          learned
        )
      ).value
    );
  });

  it('retains upfront hashes automatically, exports an agent, rehashes on main, and matches a fresh normal source-glob run', async () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('NX_CLOUD_ACCESS_TOKEN', 'test');
    fs.createDirSync('dist/app');
    // Metadata in the current timestamp tick cannot prove historical stability.
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const owner = await fixture(undefined, undefined, true);
    const tasks = Object.values(owner.taskGraph.tasks);
    const original = await owner.hasher.hashTasksUpfront(
      tasks,
      owner.taskGraph,
      Object.fromEntries(tasks.map((t) => [t.id, {}])),
      fs.tempDir
    );
    expect(getUltracacheRehasher(owner.hasher)).not.toBeNull();
    await fs.createFiles({ 'dist/app/result.txt': 'completed artifact' });
    const originalKeys = Object.fromEntries(
      tasks.map((t) => [t.id, original[t.id].value])
    );
    const executionStates = JSON.parse(
      JSON.stringify(exportUltracacheExecutionStates(originalKeys))
    );
    expect(executionStates[0].taskHashes).toEqual(originalKeys);
    expect(JSON.stringify(executionStates)).not.toContain(
      'NX_CLOUD_ACCESS_TOKEN'
    );

    const ownerFs = fs;
    const mainFs = new TempFs('rehash-main');
    try {
      for (const path of [
        'nx.json',
        'tsconfig.base.json',
        'app/old.txt',
        'app/learned.txt',
        'lib/source.txt',
      ])
        await mainFs.createFile(path, await ownerFs.readFile(path));
      fs = mainFs;
      const main = await fixture(
        undefined,
        structuredClone(owner.projectGraph),
        true
      );
      const mainTasks = Object.values(main.taskGraph.tasks);
      await main.hasher.hashTasksUpfront(
        mainTasks,
        main.taskGraph,
        Object.fromEntries(mainTasks.map((t) => [t.id, {}])),
        fs.tempDir
      );
      const retained = getUltracacheRehasher(main.hasher)!;

      const learned = configuration(['app/**/*.txt', 'lib/**/*.txt']);
      const result = await retained.rehash(learned, { executionStates });
      expect(result.skipped).toEqual({});
      const fresh = await fixture(
        undefined,
        structuredClone(owner.projectGraph)
      );
      const next = await fresh.hasher.hashTask(
        fresh.task,
        fresh.taskGraph,
        {},
        fs.tempDir,
        false,
        learned
      );
      expect(result.hashes[main.task.id]).toBe(next.value);
      expect(result.hashes[main.task.id]).not.toBe(originalKeys[main.task.id]);
      const wrong = structuredClone(executionStates);
      wrong[0].taskHashes[main.task.id] = 'different-agent-execution-hash';
      expect(
        (await retained.rehash(learned, { executionStates: wrong })).hashes[
          main.task.id
        ]
      ).toBeUndefined();
      const wrongContext = structuredClone(executionStates);
      wrongContext[0].taskContexts[main.task.id] =
        'different-owner-planning-context';
      expect(
        (await retained.rehash(learned, { executionStates: wrongContext }))
          .hashes[main.task.id]
      ).toBeUndefined();
      fs.writeFile('app/learned.txt', 'changed newly learned input');
      await updateContextWithChangedFiles(
        fs.tempDir,
        [],
        ['app/learned.txt'],
        []
      );
      const changed = await fixture(
        undefined,
        structuredClone(owner.projectGraph)
      );
      expect(
        (
          await changed.hasher.hashTask(
            changed.task,
            changed.taskGraph,
            {},
            fs.tempDir,
            false,
            learned
          )
        ).value
      ).not.toBe(next.value);
    } finally {
      fs = ownerFs;
      mainFs.cleanup();
    }
  });

  it.each([
    'restored-write',
    'hardlink-write',
    'symlink-write',
    'new-membership',
  ] as const)('rejects owner mutation evidence: %s', async (mutation) => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('NX_CLOUD_ACCESS_TOKEN', 'test');
    if (mutation === 'symlink-write')
      fs.createSymlinkSync('app/learned.txt', 'alias', 'file');
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const owner = await fixture(undefined, undefined, true);
    const original = await owner.hasher.hashTask(
      owner.task,
      owner.taskGraph,
      {},
      fs.tempDir
    );
    if (mutation === 'hardlink-write') {
      linkSync(join(fs.tempDir, 'app/learned.txt'), join(fs.tempDir, 'alias'));
      fs.writeFile('alias', 'different');
      fs.writeFile('alias', 'learned');
      unlinkSync(join(fs.tempDir, 'alias'));
    } else if (mutation === 'symlink-write') {
      fs.writeFile('alias', 'different');
      fs.writeFile('alias', 'learned');
    } else if (mutation === 'restored-write') {
      fs.writeFile('app/learned.txt', 'different');
      fs.writeFile('app/learned.txt', 'learned');
    } else {
      await fs.createFile('app/temporary.txt', 'generated and read');
      fs.removeFileSync('app/temporary.txt');
    }
    const retained = getUltracacheRehasher(owner.hasher)!;
    const state = retained.exportExecutionState({
      [owner.task.id]: original.value,
    });
    if (mutation !== 'new-membership')
      expect(state.source.invalidFiles).toContain('app/learned.txt');
    const result = await retained.rehash(configuration(['app/**/*.txt']), {
      executionStates: [JSON.parse(JSON.stringify(state))],
    });
    expect(result.hashes[owner.task.id]).toBeUndefined();
    expect(result.skipped[owner.task.id]).toMatch(/state-changed|membership/);
  });

  it('attaches an agent handed a prehashed task only when the local source hash matches', async () => {
    const { hasher, taskGraph, task } = await fixture();
    const expected = await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    const agent = await fixture();
    createUltracacheRehasher(agent.hasher);
    agent.task.hash = expected.value;
    captureUltracacheExecutionHash(
      agent.hasher,
      agent.task,
      agent.taskGraph,
      {}
    );
    expect(
      getUltracacheRehasher(agent.hasher)!.exportExecutionState({
        [task.id]: expected.value,
      }).taskHashes[task.id]
    ).toBe(expected.value);
    agent.task.hash = 'wrong-source-key';
    captureUltracacheExecutionHash(
      agent.hasher,
      agent.task,
      agent.taskGraph,
      {}
    );
    expect(
      getUltracacheRehasher(agent.hasher)!.exportExecutionState({
        [task.id]: 'wrong-source-key',
      }).taskHashes
    ).toEqual({});
  });

  it('does not add automatic capture for Cloud credentials without native activation', async () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('NX_CLOUD_ACCESS_TOKEN', 'test');
    const { hasher } = await fixture();
    expect(getUltracacheRehasher(hasher)).toBeNull();
  });

  it('withholds recent/coarse-tick source evidence rather than trusting unchanged final bytes', async () => {
    const { hasher, task, taskGraph } = await fixture(
      undefined,
      undefined,
      true
    );
    const hash = await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    const retained = getUltracacheRehasher(hasher)!;
    const state = retained.exportExecutionState({ [task.id]: hash.value });
    expect(state.source.invalidFiles).toContain('app/learned.txt');
    expect(
      (
        await retained.rehash(configuration(['app/**/*.txt']), {
          executionStates: [state],
        })
      ).hashes
    ).toEqual({});
  });

  it('does not export user environment inputs, and differing built-in encryption keys fail original-hash verification', async () => {
    const user = await fixture(
      ['{projectRoot}/old.txt', { env: 'USER_INPUT' }],
      undefined,
      true
    );
    const userHash = await user.hasher.hashTask(
      user.task,
      user.taskGraph,
      { USER_INPUT: 'secret' },
      fs.tempDir
    );
    expect(
      getUltracacheRehasher(user.hasher)!.exportExecutionState({
        [user.task.id]: userHash.value,
      }).taskHashes
    ).toEqual({});
    const owner = await fixture(undefined, undefined, true);
    const old = await owner.hasher.hashTask(
      owner.task,
      owner.taskGraph,
      { NX_CLOUD_ENCRYPTION_KEY: 'owner-secret' },
      fs.tempDir
    );
    const state = getUltracacheRehasher(owner.hasher)!.exportExecutionState({
      [owner.task.id]: old.value,
    });
    expect(state.taskHashes[owner.task.id]).toBe(old.value);
    expect(JSON.stringify(state)).not.toContain('owner-secret');
    const main = await fixture(undefined, undefined, true);
    await main.hasher.hashTask(
      main.task,
      main.taskGraph,
      { NX_CLOUD_ENCRYPTION_KEY: 'other-secret' },
      fs.tempDir
    );
    expect(
      (
        await getUltracacheRehasher(main.hasher)!.rehash(
          configuration(['app/**/*.txt']),
          { executionStates: [state] }
        )
      ).skipped[main.task.id]
    ).toBe('owner-baseline-mismatch');
  });

  it('rejects globs overlapping a captured but unobserved ignored subtree', async () => {
    await fs.createFiles({
      '.gitignore': 'app/ignored/\n',
      'app/ignored/generated.txt': 'not a source snapshot input',
    });
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const { hasher, taskGraph, task } = await fixture(
      undefined,
      undefined,
      true
    );
    const hash = await hasher.hashTask(task, taskGraph, {}, fs.tempDir);
    const retained = getUltracacheRehasher(hasher)!;
    const state = retained.exportExecutionState({ [task.id]: hash.value });
    expect(state.source.unobserved).toContain('app/ignored');
    expect(
      (
        await retained.rehash(configuration(['app/**/*.txt']), {
          executionStates: [state],
        })
      ).skipped[task.id]
    ).toBe('unobserved-membership');
  });
});
