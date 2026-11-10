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
    'kills each open command when nx exits, with what it started in a group of its own',
    async () => {
      const before = process.listeners('exit');
      const script = `const c = require('child_process').spawn('sleep', ['30'], { detached: true, stdio: 'ignore' }); console.log(c.pid); setInterval(() => {}, 1000);`;
      const command = spawnWithoutTerminal(
        `${JSON.stringify(process.execPath)} -e ${JSON.stringify(script)}`,
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
      const detachedPid = await new Promise<number>((resolve) =>
        command.stdout!.once('data', (chunk) => resolve(Number(`${chunk}`)))
      );
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
        expect(await exitsWithin(detachedPid, 2_000)).toBe(true);
      } finally {
        command.kill('SIGKILL');
        try {
          process.kill(detachedPid, 'SIGKILL');
        } catch {}
      }
    }
  );

  it.skipIf(process.platform === 'win32')(
    'forwards signals to the Windows tree killer until the shell exits, when its pid can be reused',
    async () => {
      const native = require('../native') as typeof import('../native');
      const killProcessTree = vi
        .spyOn(native, 'killProcessTree')
        .mockImplementation(() => {});
      // A real process stands in for the Windows shell, so its `exit` is real.
      // Its background job keeps the output open after the shell exits.
      const actual =
        await vi.importActual<typeof import('child_process')>('child_process');
      const shell = actual.spawn('sh', ['-c', 'sleep 30 & exec sleep 30'], {
        detached: true,
      });
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
        await new Promise((resolve) => shell.once('exit', resolve));

        Object.defineProperty(process, 'platform', { value: 'win32' });
        signalCommandsWithoutTerminal('SIGKILL');
        Object.defineProperty(process, 'platform', { value: platform });
        expect(killProcessTree).toHaveBeenCalledTimes(1);
      } finally {
        Object.defineProperty(process, 'platform', { value: platform });
        try {
          process.kill(-shell.pid!, 'SIGKILL');
        } catch {}
        killProcessTree.mockRestore();
      }
    }
  );
});

async function exitsWithin(pid: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

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
