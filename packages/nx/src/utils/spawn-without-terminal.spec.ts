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
        expect(signalCommandsWithoutTerminal('SIGINT')).toBe(true);
        Object.defineProperty(process, 'platform', { value: platform });
        expect(killProcessTree).toHaveBeenCalledWith(shell.pid, 'SIGINT');

        shell.kill();
        await new Promise((resolve) => shell.once('close', resolve));

        expect(signalCommandsWithoutTerminal('SIGKILL')).toBe(false);
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
      expect(withoutTerminalPaths(env, new Set())).toBe(env);
    }
  );
});
