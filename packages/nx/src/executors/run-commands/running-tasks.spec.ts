import * as figures from 'figures';
import { EventEmitter } from 'events';
import { stripVTControlCharacters } from 'util';
import type { MockInstance } from 'vitest';
import { output } from '../../utils/output';

// Replaces the module rather than spying. A spy reaches this code only through
// `require('child_process')`; an `import * as cp` is an interop wrapper under
// this repo's transform, not the module object, so a spy on it is not observed
// here (measured: 0 calls). Mocking the module works either way.
const mockChild = () => {
  const cp: any = new EventEmitter();
  cp.stdout = new EventEmitter();
  cp.stderr = new EventEmitter();
  cp.stdout.setEncoding = () => {};
  cp.stderr.setEncoding = () => {};
  cp.pid = 4242;
  cp.kill = () => {};
  cp.exitCode = null;
  cp.signalCode = null;
  cp.exit = (code: number) => {
    cp.exitCode = code;
    cp.emit('exit', code, null);
  };
  return cp;
};
let mockSpawned: any;
// Children for a run that spawns several, handed out in spawn order.
let mockSpawnQueue: any[] = [];
vi.mock('child_process', async () => ({
  ...require('child_process'),
  spawn: () => mockSpawnQueue.shift() ?? mockSpawned,
}));
const mockKillProcessTreeGraceful = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../native')>()),
  killProcessTreeGraceful: mockKillProcessTreeGraceful,
}));

import { PseudoTerminal } from '../../tasks-runner/pseudo-terminal';
import { runCommands, type RunCommandsOptions } from './run-commands.impl';
import { ParallelRunningTasks } from './running-tasks';

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

describe('run-commands output routing', () => {
  // Guards the routing itself rather than the tracker. A spec that calls
  // `output.writeTaskOutputChunk` directly passes even if every call site in
  // this file is reverted to a raw `process.stdout.write`, which is exactly the
  // regression that shipped once.
  it('keeps a following summary off the end of a streamed mid-line chunk', () => {
    mockSpawned = mockChild();
    const result = captureStdout(() => {
      new ParallelRunningTasks(
        {
          commands: [{ command: 'webpack --watch' }],
          color: false,
          cwd: '.',
          env: {},
          readyWhenStatus: [],
          streamOutput: true,
          envFile: undefined,
          parallel: true,
        } as any,
        { root: '.' } as any,
        { id: 'lib:dev' }
      );
      // Establish a known line start; the chunk below is what has to move it.
      output.addNewline();
      // `addColorAndPrefix` splits on newlines without appending one, so a
      // partial line from a watcher ends mid-line.
      mockSpawned.stdout.emit('data', '[webpack] compiling...');
      // A sibling task finishing is what gets glued on.
      output.logCommandSummary('nx run lib:build', 'local-cache');
    });

    const summary = `${figures.tick}  nx run lib:build`;
    const index = result.indexOf(summary);
    expect(index).toBeGreaterThan(-1);
    expect(result[index - 1]).toEqual('\n');
  });
  // The gluing test above proves the tracker end to end, but only for the
  // stdout handler - the other three writes in this class could each be
  // reverted to a raw `process.std*.write` with it still green. This pins every
  // one of them, and the stream each goes to.
  it('routes every write in the class through the line tracker', () => {
    mockSpawned = mockChild();
    const routed = vi
      .spyOn(output, 'writeTaskOutputChunk')
      .mockImplementation(() => {});

    try {
      new ParallelRunningTasks(
        {
          commands: [{ command: 'webpack --watch' }],
          color: false,
          cwd: '.',
          env: {},
          readyWhenStatus: [],
          streamOutput: true,
          envFile: undefined,
          parallel: true,
        } as any,
        { root: '.' } as any,
        { id: 'lib:dev' }
      );
      // 1. the command header, written at construction, on stdout
      const headerCall = routed.mock.calls.find((c) =>
        String(c[0]).includes('webpack --watch')
      );
      expect(headerCall).toBeDefined();
      expect(headerCall[1]).toBe(process.stdout);

      routed.mockClear();
      mockSpawned.stdout.emit('data', 'to stdout');
      expect(routed).toHaveBeenCalledTimes(1);
      // 2. stdout output goes to stdout
      expect(String(routed.mock.calls[0][0])).toContain('to stdout');
      expect(routed.mock.calls[0][1]).toBe(process.stdout);

      routed.mockClear();
      mockSpawned.stderr.emit('data', 'to stderr');
      expect(routed).toHaveBeenCalledTimes(1);
      // 3. stderr keeps its stream rather than being folded into stdout
      expect(String(routed.mock.calls[0][0])).toContain('to stderr');
      expect(routed.mock.calls[0][1]).toBe(process.stderr);

      routed.mockClear();
      mockSpawned.emit('error', new Error('spawn ENOENT'));
      expect(routed).toHaveBeenCalledTimes(1);
      // 4. the spawn-failure path, which reports on stderr
      expect(String(routed.mock.calls[0][0])).toContain('spawn ENOENT');
      expect(routed.mock.calls[0][1]).toBe(process.stderr);
    } finally {
      routed.mockRestore();
    }
  });
});

describe('run-commands completion', () => {
  let isSupported: MockInstance;
  beforeEach(() => {
    // A stdout that is not a TTY, which keeps every command off the pseudo
    // terminal and on a piped child process.
    isSupported = vi
      .spyOn(PseudoTerminal, 'isSupported')
      .mockReturnValue(false);
    mockKillProcessTreeGraceful.mockClear();
  });
  afterEach(() => {
    isSupported.mockRestore();
  });

  function start(options: Partial<RunCommandsOptions>) {
    mockSpawned = mockChild();
    return runCommands(
      {
        commands: ['build'],
        streamOutput: false,
        __unparsed__: [],
        ...options,
      },
      { root: '.' } as any,
      { id: 'lib:build' }
    );
  }

  const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

  it.each([false, true])(
    'keeps output read after the command exits (parallel: %s)',
    async (parallel) => {
      const task = await start({ parallel });
      mockSpawned.stdout.emit('data', 'HEAD\n');
      mockSpawned.exit(1);
      await nextTurn();
      mockSpawned.stdout.emit('data', 'LATE-OUT\n');
      mockSpawned.stderr.emit('data', 'LATE-ERR\n');
      mockSpawned.emit('close', 1, null);

      const { code, terminalOutput } = await task.getResults();
      expect(code).toBe(1);
      expect(terminalOutput).toContain('LATE-OUT');
      expect(terminalOutput).toContain('LATE-ERR');
      expect(terminalOutput).toContain(
        'Warning: command "build" exited with non-zero status code'
      );
    }
  );

  it('completes at readyWhen text read after a non-zero exit', async () => {
    const task = await start({ parallel: true, readyWhen: 'READY' });
    mockSpawned.exit(1);
    await nextTurn();
    mockSpawned.stdout.emit('data', 'READY\n');
    mockSpawned.stderr.emit('data', 'TAIL\n');
    mockSpawned.emit('close', 1, null);

    const { code, terminalOutput } = await task.getResults();
    expect(code).toBe(0);
    expect(stripVTControlCharacters(terminalOutput)).toMatch(/READY\n$/);
  });

  it('fails with the late output when the readyWhen text never arrives', async () => {
    const task = await start({ parallel: true, readyWhen: 'READY' });
    mockSpawned.stdout.emit('data', 'HEAD\n');
    mockSpawned.exit(1);
    await nextTurn();
    mockSpawned.stderr.emit('data', 'ERR\n');
    mockSpawned.emit('close', 1, null);

    const { code, terminalOutput } = await task.getResults();
    expect(code).toBe(1);
    expect(terminalOutput).toContain('ERR');
    expect(terminalOutput).toContain(
      'Warning: command "build" exited with non-zero status code'
    );
  });

  it("keeps a failed command's exit code when a sibling's readyWhen text follows it", async () => {
    const failing = mockChild();
    const serving = mockChild();
    mockSpawnQueue = [failing, serving];
    const task = await runCommands(
      {
        commands: ['check', 'serve'],
        parallel: true,
        readyWhen: 'READY',
        streamOutput: false,
        __unparsed__: [],
      },
      { root: '.' } as any,
      { id: 'lib:serve' }
    );
    failing.stdout.emit('data', 'CHECK-FAILED\n');
    failing.exit(1);
    await nextTurn();
    serving.stdout.emit('data', 'READY\n');
    failing.stdout.emit('data', 'TAIL\n');
    failing.emit('close', 1, null);

    const { code, terminalOutput } = await task.getResults();
    expect(code).toBe(1);
    expect(terminalOutput).toContain('CHECK-FAILED');
    expect(terminalOutput).toContain('TAIL');
  });

  it('stops parallel siblings when a command exits non-zero, before its output is read', async () => {
    const failing = mockChild();
    const sibling = mockChild();
    sibling.pid = 5151;
    mockSpawnQueue = [failing, sibling];
    const task = await runCommands(
      {
        commands: ['check', 'watch'],
        parallel: true,
        streamOutput: false,
        __unparsed__: [],
      },
      { root: '.' } as any,
      { id: 'lib:check' }
    );
    failing.exit(1);
    await nextTurn();

    expect(mockKillProcessTreeGraceful).toHaveBeenCalledWith(5151, 'SIGTERM');

    failing.emit('close', 1, null);
    sibling.exit(143);
    sibling.emit('close', 143, null);
    expect((await task.getResults()).code).toBe(1);
  });

  it('sends no signal to a command that has already exited', async () => {
    const task = await start({ parallel: false });
    mockSpawned.exit(1);
    await nextTurn();
    const killed = task.kill('SIGTERM');
    mockSpawned.emit('close', 1, null);
    await killed;

    expect(mockKillProcessTreeGraceful).not.toHaveBeenCalled();
  });

  it('starts no further command once killed while a command is draining', async () => {
    const first = mockChild();
    const second = mockChild();
    mockSpawnQueue = [first, second];
    const task = await runCommands(
      {
        commands: ['first', 'second'],
        parallel: false,
        streamOutput: false,
        __unparsed__: [],
      },
      { root: '.' } as any,
      { id: 'lib:build' }
    );
    first.exit(0);
    await nextTurn();
    const killed = task.kill('SIGTERM');
    first.emit('close', 0, null);
    await killed;
    await nextTurn();
    // Ends the second command if it was started.
    second.exit(0);
    second.emit('close', 0, null);

    const { code, terminalOutput } = await task.getResults();
    expect(code).toBe(143);
    expect(stripVTControlCharacters(terminalOutput)).not.toContain('> second');
  });
});
