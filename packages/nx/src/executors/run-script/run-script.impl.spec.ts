import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { MockInstance } from 'vitest';

let mockSpawned: any;
vi.mock('child_process', async () => ({
  ...require('child_process'),
  spawn: () => mockSpawned,
}));
const mockKillProcessTreeGraceful = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../native')>()),
  killProcessTreeGraceful: mockKillProcessTreeGraceful,
}));
// The real one can run the package manager to read its version.
vi.mock('../../utils/package-manager', () => ({
  getPackageManagerCommand: () => ({
    run: (script: string, args: string) => `npm run ${script} -- ${args}`,
  }),
}));

import { PseudoTerminal } from '../../tasks-runner/pseudo-terminal';
import runScript from './run-script.impl';

function mockChild() {
  const cp: any = new EventEmitter();
  cp.stdout = new PassThrough();
  cp.stderr = new PassThrough();
  cp.pid = 4242;
  cp.killed = false;
  cp.exitCode = null;
  cp.signalCode = null;
  cp.exit = (code: number | null, signal: NodeJS.Signals | null = null) => {
    cp.exitCode = code;
    cp.signalCode = signal;
    cp.emit('exit', code, signal);
  };
  cp.close = () => {
    cp.stdout.end();
    cp.stderr.end();
    cp.emit('close', cp.exitCode, null);
  };
  return cp;
}

const context = {
  root: '/root',
  projectName: 'lib',
  projectsConfigurations: { projects: { lib: { root: 'libs/lib' } } },
} as any;

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

describe('run-script without a pseudo terminal', () => {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
  let initialListeners: Function[][];
  let isSupported: MockInstance;
  let written: string;
  let write: MockInstance;

  beforeEach(() => {
    initialListeners = signals.map((signal) => process.listeners(signal));
    isSupported = vi
      .spyOn(PseudoTerminal, 'isSupported')
      .mockReturnValue(false);
    mockKillProcessTreeGraceful.mockClear();
    written = '';
    write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      written += chunk;
      return true;
    });
  });

  afterEach(() => {
    write.mockRestore();
    isSupported.mockRestore();
    // The executor never removes its signal listeners.
    signals.forEach((signal, i) => {
      for (const listener of process.listeners(signal)) {
        if (!initialListeners[i].includes(listener)) {
          process.removeListener(signal, listener);
        }
      }
    });
  });

  it('prints output read after the script exits before settling', async () => {
    mockSpawned = mockChild();
    let printedWhenSettled: boolean;
    const result = runScript(
      { script: 'build', __unparsed__: [] },
      context
    ).then((r) => {
      printedWhenSettled = written.includes('LATE');
      return r;
    });

    mockSpawned.exit(0);
    await nextTurn();
    mockSpawned.stdout.write('LATE\n');
    await nextTurn();
    mockSpawned.close();

    expect(await result).toEqual({ success: true });
    expect(printedWhenSettled).toBe(true);
  });

  it('stays failed and sends no signal when SIGTERM follows a failed exit', async () => {
    mockSpawned = mockChild();
    const result = runScript({ script: 'build', __unparsed__: [] }, context);
    const [onSigterm] = process
      .listeners('SIGTERM')
      .filter((listener) => !initialListeners[1].includes(listener));

    mockSpawned.exit(1);
    await nextTurn();
    onSigterm('SIGTERM');
    await nextTurn();
    mockSpawned.close();

    expect(await result).toEqual({ success: false });
    expect(mockKillProcessTreeGraceful).not.toHaveBeenCalled();
  });

  it('stays failed when SIGTERM kills the script before its output closes', async () => {
    mockSpawned = mockChild();
    let killFinished: () => void;
    mockKillProcessTreeGraceful.mockImplementationOnce(
      () => new Promise<void>((resolve) => (killFinished = resolve))
    );
    const result = runScript({ script: 'build', __unparsed__: [] }, context);
    const [onSigterm] = process
      .listeners('SIGTERM')
      .filter((listener) => !initialListeners[1].includes(listener));

    onSigterm('SIGTERM');
    mockSpawned.exit(null, 'SIGTERM');
    killFinished();
    await nextTurn();
    mockSpawned.close();

    expect(await result).toEqual({ success: false });
  });
});
