import { fork, type ForkOptions } from 'child_process';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { TaskGraph } from '../config/task-graph';
import { parseMessage } from '../utils/consume-messages-from-socket';
import { BatchMessageType } from './batch/batch-messages';
import { ForkedProcessTaskRunner } from './forked-process-task-runner';

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  fork: vi.fn(),
}));

vi.mock('./utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils')>()),
  getCliPath: () => '/test/run-executor.js',
}));

function graph(): TaskGraph {
  const nodes: Record<string, string> = {};
  for (let i = 0; i < 300; i++) nodes[`workspace:lib/file-${i}.ts`] = 'h';
  return {
    roots: ['a'],
    dependencies: {},
    continuousDependencies: {},
    tasks: Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => [
        id,
        {
          id,
          target: { project: id, target: 'build' },
          overrides: { __overrides_unparsed__: [] },
          outputs: [],
          hash: `hash-${id}`,
          hashDetails: { command: 'build', nodes },
        },
      ])
    ),
  };
}

describe('task graph transport to worker processes', () => {
  let child: any;
  let options: ForkOptions;
  const streams: PassThrough[] = [];

  beforeEach(() => {
    vi.mocked(fork).mockImplementation(((
      _path: string,
      config: ForkOptions
    ) => {
      options = config;
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
    'sends the graph as one encoded buffer over an advanced channel (piped output=%s)',
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
      expect(options.serialization).toBe('advanced');
      expect(child.send).toHaveBeenCalledTimes(1);
      const message = child.send.mock.calls[0][0];
      expect(message.targetDescription).toEqual(input.tasks.a.target);
      expect(Buffer.isBuffer(message.taskGraph)).toBe(true);
      expect(parseMessage(message.taskGraph)).toEqual(input);
    }
  );

  it('reuses the encoded bytes across forks until a task is re-hashed', async () => {
    const input = graph();
    const runner = new ForkedProcessTaskRunner({ lifeCycle: {} } as any, false);
    const forkFor = async (task: TaskGraph['tasks'][string]) => {
      await runner.forkProcessLegacy(task, {
        taskGraph: input,
        env: {},
        temporaryOutputPath: '/unused',
        streamOutput: false,
        pipeOutput: true,
      });
      return child.send.mock.calls[0][0].taskGraph as Buffer;
    };
    const first = await forkFor(input.tasks.a);
    input.tasks.a.startTime = 1;
    input.tasks.a.endTime = 2;
    expect(await forkFor(input.tasks.b)).toBe(first);
    input.tasks.b.hash = 'rehashed';
    const after = await forkFor(input.tasks.c);
    expect(after).not.toBe(first);
    expect(parseMessage<TaskGraph>(after).tasks.b.hash).toBe('rehashed');
  });

  it('sends both batch graphs as encoded buffers', async () => {
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
    expect(options.serialization).toBe('advanced');
    const message = child.send.mock.calls[0][0];
    expect(message.type).toBe(BatchMessageType.RunTasks);
    expect(parseMessage(message.batchTaskGraph)).toEqual(batch);
    expect(parseMessage(message.fullTaskGraph)).toEqual(full);
  });
});
