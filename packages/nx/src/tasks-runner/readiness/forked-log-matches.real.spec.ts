import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Task } from '../../config/task-graph';
import type { TargetConfiguration } from '../../config/workspace-json-project-json';
import { ForkedProcessTaskRunner } from '../forked-process-task-runner';
import { PseudoTerminal } from '../pseudo-terminal';
import type { RunningTask } from '../running-tasks/running-task';
import { waitForReadiness } from './probes';
import { normalizeReadyWhen } from './ready-when';

// Source ships no built fork.js or run-executor.js, so the forks load these
// shims, which run the TypeScript source through swc
const { root, nxRoot, shims } = vi.hoisted(() => {
  const { mkdirSync, mkdtempSync, realpathSync, writeFileSync } =
    require('node:fs') as typeof import('node:fs');
  const { tmpdir } = require('node:os') as typeof import('node:os');
  const { join } = require('node:path') as typeof import('node:path');
  const nxRoot = join(__dirname, '..', '..', '..');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'nx-forked-log-')));
  const shimDir = join(root, 'shims');
  mkdirSync(shimDir);
  const swc = `require(${JSON.stringify(
    require.resolve('@swc-node/register', { paths: [nxRoot] })
  )});`;
  const shims = {
    runExecutor: join(shimDir, 'run-executor.js'),
    fork: join(shimDir, 'fork.js'),
  };
  writeFileSync(
    shims.runExecutor,
    `${swc}\nrequire(${JSON.stringify(join(nxRoot, 'bin', 'run-executor.ts'))});\n`
  );
  writeFileSync(
    shims.fork,
    [
      swc,
      `const childProcess = require('node:child_process');`,
      `const fork = childProcess.fork;`,
      `childProcess.fork = (_script, options) => fork(${JSON.stringify(shims.runExecutor)}, options);`,
      `require(${JSON.stringify(join(nxRoot, 'src', 'tasks-runner', 'fork.ts'))});`,
      '',
    ].join('\n')
  );
  return { root, nxRoot, shims };
});

// Keeps the pty fork's IPC socket out of this repo's daemon directory
vi.mock('../../utils/workspace-root', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/workspace-root')>()),
  workspaceRoot: root,
}));
vi.mock('../utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils')>()),
  getCliPath: () => shims.runExecutor,
}));

const command = `node -e "console.log(40 + 2); setTimeout(() => console.log('listening'), 1000)"`;

const rows: [
  name: string,
  fork: 'pty' | 'pipe',
  target: TargetConfiguration,
  // Text in the command line Nx prints, which the process prints only after 42
  logMatches: string,
  commandLine: string,
][] = [
  [
    'run-commands task in a pty fork',
    'pty',
    { executor: 'nx:run-commands', options: { command } },
    'listening',
    `> ${command}`,
  ],
  [
    'run-commands task in a pipe fork',
    'pipe',
    { executor: 'nx:run-commands', options: { command } },
    'listening',
    `> ${command}`,
  ],
  [
    'run-commands task with parallel commands',
    'pipe',
    { executor: 'nx:run-commands', options: { commands: [command] } },
    'listening',
    `> ${command}`,
  ],
  [
    'run-commands task with usePty',
    'pty',
    { executor: 'nx:run-commands', options: { command, usePty: true } },
    'listening',
    `> ${command}`,
  ],
  [
    'run-commands task that another executor runs',
    'pipe',
    { executor: 'nx:nested' },
    'listening',
    `> ${command}`,
  ],
  [
    'run-script task in a pty fork',
    'pty',
    { executor: 'nx:run-script', options: { script: 'serve' } },
    'run serve',
    '> npm run serve',
  ],
];

const task: Task = {
  id: 'app:serve',
  target: { project: 'app', target: 'serve' },
  overrides: { __overrides_unparsed__: [] },
  outputs: [],
  projectRoot: 'app',
  continuous: true,
  cache: false,
  parallelism: true,
};

beforeAll(() => {
  writeFileSync(
    join(root, 'nx.json'),
    JSON.stringify({ cli: { packageManager: 'npm' } })
  );
  // The `nx` package the forks resolve executors from, pointed at source
  const nxPackage = join(root, 'node_modules', 'nx');
  mkdirSync(nxPackage, { recursive: true });
  writeFileSync(
    join(nxPackage, 'package.json'),
    JSON.stringify({ name: 'nx', executors: './executors.json' })
  );
  const executor = (name: string) => {
    const dir = relative(nxPackage, join(nxRoot, 'src', 'executors', name));
    return {
      implementation: join(dir, `${name}.impl.ts`),
      schema: join(dir, 'schema.json'),
    };
  };
  // Runs `app:inner` the way executors run their build target
  writeFileSync(
    join(nxPackage, 'nested.js'),
    [
      `const { runExecutor } = require(${JSON.stringify(join(nxRoot, 'src', 'command-line', 'run', 'run.ts'))});`,
      `exports.default = async function (_options, context) {`,
      `  const target = { project: 'app', target: 'inner' };`,
      `  for await (const result of await runExecutor(target, {}, context)) {`,
      `    if (!result.success) return result;`,
      `  }`,
      `  return { success: true };`,
      `};`,
      '',
    ].join('\n')
  );
  writeFileSync(
    join(nxPackage, 'nested.json'),
    JSON.stringify({ version: 2, type: 'object', properties: {} })
  );
  writeFileSync(
    join(nxPackage, 'executors.json'),
    JSON.stringify({
      executors: {
        'run-commands': executor('run-commands'),
        'run-script': executor('run-script'),
        nested: { implementation: './nested.js', schema: './nested.json' },
      },
    })
  );
  mkdirSync(join(root, 'app'));
  writeFileSync(
    join(root, 'app', 'package.json'),
    JSON.stringify({
      name: 'app',
      scripts: {
        // npm echoes the script, and that echo must not contain "run serve"
        serve: `node -e "console.log(40 + 2); setTimeout(() => console.log(['run', 'serve'].join(' ')), 1000)"`,
      },
    })
  );
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

beforeEach(() => {
  // The worker has no TTY, which the parent needs to fork with a pty
  vi.spyOn(PseudoTerminal, 'isSupported').mockReturnValue(true);
  const fork = PseudoTerminal.prototype.fork;
  vi.spyOn(PseudoTerminal.prototype, 'fork').mockImplementation(function (
    this: PseudoTerminal,
    id: string,
    _script: string,
    options: Parameters<PseudoTerminal['fork']>[2]
  ) {
    return fork.call(this, id, shims.fork, options);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function startTask(
  fork: 'pty' | 'pipe',
  target: TargetConfiguration
): Promise<RunningTask> {
  const dataDirectory = join(root, 'workspace-data');
  mkdirSync(dataDirectory, { recursive: true });
  // The fork reads the project graph from the cache, as under a run
  writeFileSync(
    join(dataDirectory, 'project-graph.json'),
    JSON.stringify({
      nodes: {
        app: {
          name: 'app',
          type: 'app',
          data: {
            root: 'app',
            targets: {
              serve: { ...target, continuous: true },
              inner: { executor: 'nx:run-commands', options: { command } },
            },
          },
        },
      },
      dependencies: { app: [] },
    })
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NX_WORKSPACE_ROOT: root,
    NX_WORKSPACE_ROOT_PATH: root,
    NX_WORKSPACE_DATA_DIRECTORY: dataDirectory,
    NX_TASK_TARGET_PROJECT: 'app',
    NX_TASK_TARGET_TARGET: 'serve',
    NX_TASK_TARGET_CONFIGURATION: undefined,
    NX_TUI: 'false',
    SWC_NODE_PROJECT: join(nxRoot, 'tsconfig.lib.json'),
  };
  // A logMatches task gets no output file. Capturing to one would keep the
  // fork's stdout from the parent
  delete env.NX_TERMINAL_OUTPUT_PATH;
  // Under the TUI the parent forks with a pty, without it a continuous task
  // gets a pipe
  const tuiEnabled = fork === 'pty';
  vi.stubEnv('NX_TUI', String(tuiEnabled));
  const runner = new ForkedProcessTaskRunner(
    { lifeCycle: { printTaskTerminalOutput: () => {} } } as any,
    tuiEnabled
  );
  const runningTask = await runner.forkProcess(task, {
    temporaryOutputPath: join(root, 'terminal-output'),
    streamOutput: false,
    pipeOutput: true,
    taskGraph: {
      roots: [task.id],
      tasks: { [task.id]: task },
      dependencies: { [task.id]: [] },
      continuousDependencies: { [task.id]: [] },
    },
    env,
    disablePseudoTerminal: fork === 'pipe',
  });
  onTestFinished(() => runningTask.kill());
  return runningTask;
}

describe('logMatches on a task Nx runs in a forked process', () => {
  const settled = (promise: Promise<unknown>) =>
    Promise.race([
      promise.then(
        () => 'resolved',
        () => 'rejected'
      ),
      new Promise((r) => setTimeout(() => r('pending'), 20)),
    ]);

  it.each(rows)(
    'does not match the command line Nx prints for a %s',
    async (_, fork, target, logMatches) => {
      const runningTask = await startTask(fork, {
        ...target,
        readyWhen: { logMatches },
      });
      const output: string[] = [];
      const controller = new AbortController();
      const ready = waitForReadiness(
        normalizeReadyWhen({ logMatches }, task.id, {
          workspaceRoot: root,
          projectRoot: 'app',
          projectName: 'app',
          options: {},
          env: () => process.env,
        }),
        { taskId: task.id, runningTask, cwd: root, signal: controller.signal }
      );
      onTestFinished(() => controller.abort());
      // Only the process prints 42, and the command line arrives before it
      await new Promise<void>((resolve, reject) => {
        runningTask.onOutput((chunk) => {
          output.push(chunk);
          if (chunk.includes('42')) resolve();
        });
        runningTask.onExit(() =>
          reject(new Error(`The task exited:\n${output.join('')}`))
        );
      });
      await expect(settled(ready)).resolves.toBe('pending');
      await expect(ready).resolves.toEqual({});
    }
  );

  it.each(rows)(
    'keeps the command line Nx prints for a %s without logMatches',
    async (_, fork, target, _logMatches, commandLine) => {
      const runningTask = await startTask(fork, {
        ...target,
        readyWhen: { port: 4200 },
      });
      const { terminalOutput } = await runningTask.getResults();
      expect(terminalOutput).toContain(commandLine);
    }
  );
});
