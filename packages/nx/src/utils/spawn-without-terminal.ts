import { type ChildProcess, spawn, type SpawnOptions } from 'child_process';
import { fstatSync, statSync } from 'fs';
import { isatty } from 'tty';

// The commands spawned below whose output is still open, by pid. On POSIX each
// one leads its own process group.
const commands = new Map<number, ChildProcess>();

/**
 * Runs `command` in a shell that cannot reach the terminal nx shares with
 * another program, so a prompt fails instead of waiting for keys that program
 * reads. On POSIX the shell leads a new session with no controlling terminal,
 * and loses every environment variable that names nx's terminal. Windows
 * spawns it as usual, and with no stdio inherited it gets no console, so the
 * terminal's Ctrl+C misses it there too. Whoever shares the terminal forwards
 * signals with `signalCommandsWithoutTerminal`, and an nx that exits first
 * kills each command whose output is still open.
 */
export function spawnWithoutTerminal(
  command: string,
  options: Omit<SpawnOptions, 'shell' | 'detached'>
): ChildProcess {
  const child = spawn(command, {
    ...options,
    shell: true,
    windowsHide: true,
    detached: process.platform !== 'win32',
    ...(process.platform !== 'win32' && {
      env: withoutTerminalPaths(options.env ?? process.env, stdioTerminals()),
    }),
  });
  const pid = child.pid;
  if (pid !== undefined) {
    if (commands.size === 0) process.on('exit', killCommands);
    commands.set(pid, child);
    child.once('close', () => {
      commands.delete(pid);
      if (commands.size === 0) process.removeListener('exit', killCommands);
    });
  }
  return child;
}

/**
 * Sends `signal` to every command started by `spawnWithoutTerminal` whose
 * output is still open: to its process group on POSIX, and on a SIGKILL also to
 * the processes still descending from its shell, since a parent killed outright
 * cannot stop the ones it started in groups of their own. Windows has no
 * process groups, so there those descendants are terminated, whatever the
 * signal.
 */
export function signalCommandsWithoutTerminal(signal: NodeJS.Signals): void {
  for (const [pid, child] of commands) {
    // Tree first: killing the group reparents its members' children.
    if (process.platform === 'win32' || signal === 'SIGKILL') {
      killTree(child, pid, signal);
    }
    if (process.platform !== 'win32') {
      try {
        process.kill(-pid, signal);
      } catch {
        // The command already ended; its `close` is on the way.
      }
    }
  }
}

// Only while the shell lives: once it has exited, its pid can be reused.
function killTree(
  child: ChildProcess,
  pid: number,
  signal: NodeJS.Signals
): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    const { killProcessTree } =
      require('../native') as typeof import('../native');
    killProcessTree(pid, signal);
  } catch {
    // No native killer in this build; on POSIX the group signal still goes out.
  }
}

function killCommands(): void {
  signalCommandsWithoutTerminal('SIGKILL');
}

function stdioTerminals(): Set<number> {
  const devices = new Set<number>();
  for (const fd of [0, 1, 2]) {
    if (isatty(fd)) devices.add(fstatSync(fd).rdev);
  }
  return devices;
}

/**
 * `env` without the variables whose value is the path of one of `terminals`
 * (device ids). A process outside the new session, such as gpg-agent reading
 * `GPG_TTY`, would otherwise open that terminal itself.
 */
export function withoutTerminalPaths(
  env: NodeJS.ProcessEnv,
  terminals: ReadonlySet<number>
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => !namesTerminal(value, terminals))
  );
}

function namesTerminal(
  value: string | undefined,
  terminals: ReadonlySet<number>
): boolean {
  if (!value?.startsWith('/dev/')) return false;
  try {
    const stat = statSync(value);
    return stat.isCharacterDevice() && terminals.has(stat.rdev);
  } catch {
    return false;
  }
}
