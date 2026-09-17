import { fork } from 'child_process';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { TaskGraph } from '../config/task-graph';
import { BatchMessageType } from './batch/batch-messages';
import { ForkedProcessTaskRunner } from './forked-process-task-runner';
import { pruneTaskGraph } from './prune-task-graph';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  fork: jest.fn(),
}));

// Named mock* so jest allows the mock factory below to close over it.
const mockPty = (() => {
  const proc = { getPid: () => 4242, send: jest.fn(), onExit: jest.fn() };
  const terminal = {
    init: async () => {},
    onMessageFromChildren: () => {},
    fork: jest.fn(async () => proc),
  };
  return { proc, terminal };
})();
jest.mock('./pseudo-terminal', () => ({
  PseudoTerminal: { isSupported: () => true },
  createPseudoTerminal: () => mockPty.terminal,
}));

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
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
    (fork as jest.Mock).mockImplementation((() => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      streams.push(stdout, stderr);
      child = Object.assign(new EventEmitter(), {
        stdout,
        stderr,
        stdio: [null, stdout, stderr, null],
        // BatchProcess.send forwards only while the channel is connected.
        connected: true,
        send: jest.fn(),
      });
      return child;
    }) as typeof fork);
  });

  afterEach(() => {
    for (const stream of streams.splice(0)) stream.destroy();
    jest.restoreAllMocks();
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
    expect(mockPty.terminal.fork).toHaveBeenCalledTimes(1);
    const message = mockPty.proc.send.mock.calls[0][0];
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
