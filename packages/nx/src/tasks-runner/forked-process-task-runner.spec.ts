import { fork } from 'child_process';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { TaskGraph } from '../config/task-graph';
import { BatchMessageType } from './batch/batch-messages';
import { ForkedProcessTaskRunner } from './forked-process-task-runner';
import { pruneTaskGraph } from './prune-task-graph';

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  fork: vi.fn(),
}));

const pty = vi.hoisted(() => {
  const proc = { getPid: () => 4242, send: vi.fn(), onExit: vi.fn() };
  const terminal = {
    init: async () => {},
    onMessageFromChildren: () => {},
    fork: vi.fn(async () => proc),
  };
  return { proc, terminal };
});
vi.mock('./pseudo-terminal', () => ({
  PseudoTerminal: { isSupported: () => true },
  createPseudoTerminal: () => pty.terminal,
}));

vi.mock('./utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils')>()),
  getCliPath: () => '/test/run-executor.js',
}));

function graph(): TaskGraph {
  return {
    roots: ['a'],
    dependencies: {},
    continuousDependencies: {},
    tasks: Object.fromEntries(
      ['a', 'b', 'c'].map((id) => [
        id,
        {
          id,
          target: { project: id, target: 'build' },
          overrides: { __overrides_unparsed__: [] },
          outputs: [],
          hash: `hash-${id}`,
          hashDetails: { command: 'build', nodes: { 'workspace:x.ts': 'h' } },
        },
      ])
    ),
  } as any;
}

describe('task graph transport to worker processes', () => {
  let child: any;
  const streams: PassThrough[] = [];

  beforeEach(() => {
    vi.mocked(fork).mockImplementation((() => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      streams.push(stdout, stderr);
      child = Object.assign(new EventEmitter(), {
        stdout,
        stderr,
        stdio: [null, stdout, stderr, null],
        // BatchProcess.send forwards only while the channel is connected.
        connected: true,
        send: vi.fn(),
      });
      return child;
    }) as typeof fork);
  });

  afterEach(() => {
    for (const stream of streams.splice(0)) stream.destroy();
    vi.restoreAllMocks();
  });

  it.each([false, true])(
    'sends the graph without hash details (piped output=%s)',
    async (pipeOutput) => {
      const input = graph();
      const runner = new ForkedProcessTaskRunner(
        { lifeCycle: {} } as any,
        false
      );
      await runner.forkProcessLegacy(input.tasks.a, {
        taskGraph: input,
        env: { NX_DAEMON: 'false' },
        temporaryOutputPath: '/unused',
        streamOutput: false,
        pipeOutput,
      });
      expect(child.send).toHaveBeenCalledTimes(1);
      const message = child.send.mock.calls[0][0];
      expect(message.targetDescription).toEqual(input.tasks.a.target);
      expect(message.taskGraph).toBe(pruneTaskGraph(input));
      expect(Object.keys(message.taskGraph.tasks)).toEqual(['a', 'b', 'c']);
      expect(Object.keys(message.taskGraph.tasks.a).sort()).toEqual([
        'id',
        'outputs',
        'overrides',
        'target',
      ]);
      expect(input.tasks.a.hashDetails).toBeDefined();
    }
  );

  it('sends a pruned graph on the pseudo-terminal path too', async () => {
    const input = graph();
    const runner = new ForkedProcessTaskRunner({ lifeCycle: {} } as any, true);
    await runner.forkProcess(input.tasks.a, {
      taskGraph: input,
      env: {},
      temporaryOutputPath: '/unused',
      streamOutput: true,
      pipeOutput: false,
      disablePseudoTerminal: false,
    });
    expect(pty.terminal.fork).toHaveBeenCalledTimes(1);
    const message = pty.proc.send.mock.calls[0][0];
    expect(message.taskGraph).toBe(pruneTaskGraph(input));
    expect(message.taskGraph.tasks.a).not.toHaveProperty('hashDetails');
  });

  it('sends both batch graphs without hash details', async () => {
    const full = graph();
    const batch: TaskGraph = {
      ...full,
      tasks: { a: full.tasks.a, b: full.tasks.b },
      roots: ['a'],
    };
    const runner = new ForkedProcessTaskRunner({ lifeCycle: {} } as any, false);
    await runner.forkProcessForBatch(
      { executorName: 'nx:noop', taskGraph: batch } as any,
      { nodes: {}, dependencies: {} } as any,
      full,
      {}
    );
    const message = child.send.mock.calls[0][0];
    expect(message.type).toBe(BatchMessageType.RunTasks);
    expect(message.batchTaskGraph).toBe(pruneTaskGraph(batch));
    expect(message.fullTaskGraph).toBe(pruneTaskGraph(full));
    expect(Object.keys(message.batchTaskGraph.tasks)).toEqual(['a', 'b']);
    expect(message.fullTaskGraph.tasks.c).not.toHaveProperty('hash');
  });
});
