import { spawn } from 'child_process';
import { statSync } from 'fs';
import {
  signalCommandsWithoutTerminal,
  spawnWithoutTerminal,
  withoutTerminalPaths,
} from './spawn-without-terminal';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

describe('spawnWithoutTerminal', () => {
  it.skipIf(process.platform === 'win32')(
    'kills each open command when nx exits',
    async () => {
      const before = process.listeners('exit');
      const command = spawnWithoutTerminal('sleep 30', {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const closed = new Promise<NodeJS.Signals | null>((resolve) =>
        command.once('close', (_code, signal) => resolve(signal))
      );
      try {
        // Emitting 'exit' would also run the test runner's own listeners.
        for (const listener of process.listeners('exit')) {
          if (!before.includes(listener)) listener(0);
        }
        const signal = await Promise.race([
          closed,
          new Promise((resolve) =>
            setTimeout(() => resolve('still running'), 2_000)
          ),
        ]);
        expect(signal).toBe('SIGKILL');
      } finally {
        command.kill('SIGKILL');
      }
    }
  );

  it.skipIf(process.platform === 'win32')(
    'terminates the process tree of each open command on Windows',
    async () => {
      const native = require('../native') as typeof import('../native');
      const killProcessTree = vi
        .spyOn(native, 'killProcessTree')
        .mockImplementation(() => {});
      // A real process stands in for the Windows shell, so its `close` is real.
      const actual =
        await vi.importActual<typeof import('child_process')>('child_process');
      const shell = actual.spawn('sleep', ['30']);
      vi.mocked(spawn).mockReturnValueOnce(shell);
      const platform = process.platform;
      try {
        Object.defineProperty(process, 'platform', { value: 'win32' });
        spawnWithoutTerminal('npm install', {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        signalCommandsWithoutTerminal('SIGINT');
        Object.defineProperty(process, 'platform', { value: platform });
        expect(killProcessTree).toHaveBeenCalledWith(shell.pid, 'SIGINT');

        shell.kill();
        await new Promise((resolve) => shell.once('close', resolve));

        Object.defineProperty(process, 'platform', { value: 'win32' });
        signalCommandsWithoutTerminal('SIGKILL');
        Object.defineProperty(process, 'platform', { value: platform });
        expect(killProcessTree).toHaveBeenCalledTimes(1);
      } finally {
        Object.defineProperty(process, 'platform', { value: platform });
        shell.kill();
        killProcessTree.mockRestore();
      }
    }
  );
});

describe('withoutTerminalPaths', () => {
  it.skipIf(process.platform === 'win32')(
    'drops the variables naming one of the terminals and keeps the rest',
    () => {
      const terminal = statSync('/dev/null').rdev;
      const env = {
        GPG_TTY: '/dev/null',
        OTHER_DEVICE: '/dev/zero',
        MISSING: '/dev/does-not-exist',
        PATH: '/usr/bin:/bin',
        EMPTY: '',
      };

      expect(withoutTerminalPaths(env, new Set([terminal]))).toEqual({
        OTHER_DEVICE: '/dev/zero',
        MISSING: '/dev/does-not-exist',
        PATH: '/usr/bin:/bin',
        EMPTY: '',
      });
      expect(withoutTerminalPaths(env, new Set())).toEqual(env);
    }
  );
});
