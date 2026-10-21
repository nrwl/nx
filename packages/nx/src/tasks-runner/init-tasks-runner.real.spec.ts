import { rmSync } from 'node:fs';
import type { ProjectGraph } from '../config/project-graph';
import type { Task, TaskGraph } from '../config/task-graph';
import type { TargetConfiguration } from '../config/workspace-json-project-json';
import { runCommands } from '../executors/run-commands/run-commands.impl';
import { RunningTasksService } from '../native';
import { getLocalDbConnection } from '../utils/db-connection';
import type { LifeCycle } from './life-cycle';
import { SharedRunningTask } from './running-tasks/shared-running-task';

const { root } = vi.hoisted(() => {
  const { mkdtempSync, realpathSync, writeFileSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'nx-agent-tasks-')));
  writeFileSync(
    join(root, 'nx.json'),
    JSON.stringify({ neverConnectToCloud: true })
  );
  return { root };
});

vi.mock('../utils/workspace-root', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/workspace-root')>()),
  workspaceRoot: root,
}));
const hashTask = vi.hoisted(() =>
  vi.fn(async (task: Task) => ({
    value: `${task.id}-hash`,
    details: { command: '', nodes: {}, implicitDeps: {}, runtime: {} },
  }))
);
vi.mock('../hasher/create-task-hasher', () => ({
  createTaskHasher: () => ({ hashTask }),
}));
vi.mock('../utils/dotenv', () => ({ loadRootEnvFiles: vi.fn() }));
vi.mock('./run-command', () => ({
  constructLifeCycles: () => [],
  getRunner: () => ({ runnerOptions: {} }),
  setEnvVarsBasedOnArgs: vi.fn(),
}));
vi.mock('./utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils')>()),
  // Source ships no built run-executor.js; nothing here forks a process
  getCliPath: vi.fn(() => 'run-executor.js'),
  getCustomHasher: vi.fn(() => null),
  getExecutorForTask: vi.fn(() => ({ schema: { properties: {} } })),
}));
// A server that prints its output and runs until it is killed
vi.mock('../executors/run-commands/run-commands.impl', () => ({
  runCommands: vi.fn(async (options: { command: string }) => {
    const outputListeners: ((output: string) => void)[] = [];
    const exitListeners: ((code: number, output: string) => void)[] = [];
    let exit: (code: number) => void;
    const results = new Promise<{ code: number; terminalOutput: string }>(
      (resolve) => {
        exit = (code) => {
          resolve({ code, terminalOutput: options.command });
          exitListeners.forEach((cb) => cb(code, options.command));
        };
      }
    );
    setTimeout(() => outputListeners.forEach((cb) => cb(options.command)));
    return {
      getResults: () => results,
      onOutput: (cb: (output: string) => void) => outputListeners.push(cb),
      onExit: (cb: (code: number, output: string) => void) =>
        exitListeners.push(cb),
      kill: () => exit(0),
    };
  }),
}));

import { runContinuousTasks, runDiscreteTasks } from './init-tasks-runner';

function createTask(id: string, task: Partial<Task> = {}): Task {
  const [project, target] = id.split(':');
  return {
    id,
    target: { project, target },
    overrides: { __overrides_unparsed__: [] },
    outputs: [],
    projectRoot: project,
    cache: false,
    parallelism: true,
    ...task,
  };
}

function createGraphs(
  targets: Record<string, TargetConfiguration>,
  tasks: Task[],
  continuousDependencies: TaskGraph['continuousDependencies'] = {}
) {
  const projectGraph = {
    nodes: Object.fromEntries(
      tasks.map(({ target: { project, target } }) => [
        project,
        {
          name: project,
          type: 'app',
          data: { root: project, targets: { [target]: targets[project] } },
        },
      ])
    ),
    dependencies: Object.fromEntries(tasks.map((t) => [t.target.project, []])),
  } as ProjectGraph;
  const fullTaskGraph: TaskGraph = {
    roots: tasks.map((t) => t.id),
    tasks: Object.fromEntries(
      tasks.map((t) => [t.id, { ...t, hash: `${t.id}-hash` }])
    ),
    dependencies: Object.fromEntries(tasks.map((t) => [t.id, []])),
    continuousDependencies: Object.fromEntries(
      tasks.map((t) => [t.id, continuousDependencies[t.id] ?? []])
    ),
  };
  // Nx Cloud hands the agent its batch with the hashes cleared
  const batch = tasks.map((t) => ({ ...t, hash: null }));
  return { projectGraph, fullTaskGraph, batch };
}

describe('agent entry points', () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('hashes and starts a server held back for a server in the same batch', async () => {
    const tasks = [
      createTask('api:serve', { continuous: true }),
      createTask('web:serve', { continuous: true }),
    ];
    const { projectGraph, fullTaskGraph, batch } = createGraphs(
      {
        api: {
          executor: 'nx:run-commands',
          continuous: true,
          options: { command: 'api listening' },
          readyWhen: { logMatches: 'listening' },
        },
        web: {
          executor: 'nx:run-commands',
          continuous: true,
          options: { command: 'web listening' },
        },
      },
      tasks,
      { 'web:serve': [{ id: 'api:serve', waitFor: 'ready' }] }
    );

    const running = await runContinuousTasks(
      batch,
      projectGraph,
      fullTaskGraph,
      {},
      {} as LifeCycle
    );
    const servers = await Promise.all(Object.values(running));

    expect(vi.mocked(runCommands).mock.calls.map(([, , task]) => task)).toEqual(
      [
        expect.objectContaining({ id: 'api:serve', hash: 'api:serve-hash' }),
        expect.objectContaining({ id: 'web:serve', hash: 'web:serve-hash' }),
      ]
    );
    await Promise.all(servers.map((server) => server.kill()));
  });

  it('ignores a failure to hash a server another process runs', async () => {
    const tasks = [createTask('api:serve', { continuous: true })];
    const { projectGraph, fullTaskGraph, batch } = createGraphs(
      {
        api: {
          executor: 'nx:run-commands',
          continuous: true,
          options: { command: 'api listening' },
        },
      },
      tasks
    );
    const otherProcess = new RunningTasksService(getLocalDbConnection());
    otherProcess.addRunningTask('api:serve');
    hashTask.mockRejectedValueOnce(new Error('hashing failed'));

    const running = await runContinuousTasks(
      batch,
      projectGraph,
      fullTaskGraph,
      {},
      {} as LifeCycle
    );
    const api = await running['api:serve'];

    expect(api).toBeInstanceOf(SharedRunningTask);
    await api.kill();
    otherProcess.removeRunningTask('api:serve');
  });

  it('hashes and runs every task of a batch with a task that is not parallel', async () => {
    const tasks = [
      createTask('a:build', { cache: true, parallelism: false }),
      createTask('b:build', { cache: true }),
    ];
    const { projectGraph, fullTaskGraph, batch } = createGraphs(
      { a: { executor: 'nx:noop' }, b: { executor: 'nx:noop' } },
      tasks
    );

    const results = await runDiscreteTasks(
      batch,
      projectGraph,
      fullTaskGraph,
      {},
      {} as LifeCycle
    );

    expect(
      (await Promise.all(results))
        .flat()
        .map(({ task, status }) => [task.id, task.hash, status])
    ).toEqual([
      ['a:build', 'a:build-hash', 'success'],
      ['b:build', 'b:build-hash', 'success'],
    ]);
  });
});
