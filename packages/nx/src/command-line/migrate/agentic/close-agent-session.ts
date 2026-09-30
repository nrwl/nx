import { type ChildProcess, execSync } from 'child_process';

export const AGENT_GRACEFUL_EXIT_MS = 5_000;

// Safety bound after force-kill. SIGKILL normally reaps in microseconds;
// the bound exists for uninterruptible kernel calls or taskkill returning
// before the process actually exits.
export const FORCE_KILL_WAIT_MS = 500;

export interface ExitInfo {
  code?: number | null;
  signal?: NodeJS.Signals | null;
  error?: Error;
}

// Merge window so a paired exit + error both land in one ExitInfo. On
// error-only paths like spawn ENOENT, where Node fires error but never exit,
// this timer is the only settlement mechanism.
const EXIT_MERGE_WINDOW_MS = 10;

export function waitForExit(child: ChildProcess): Promise<ExitInfo> {
  return new Promise<ExitInfo>((resolve) => {
    const info: ExitInfo = {};
    let pending: NodeJS.Timeout | null = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      if (pending) clearTimeout(pending);
      resolve(info);
    };
    const onFirst = () => {
      if (settled || pending) return;
      pending = setTimeout(settle, EXIT_MERGE_WINDOW_MS);
    };
    child.on('exit', (code, signal) => {
      info.code = code;
      info.signal = signal;
      onFirst();
    });
    child.on('error', (error) => {
      info.error = error;
      onFirst();
    });
  });
}

/**
 * Stops a running agent process.
 *
 * POSIX: SIGINT, then SIGKILL after a bounded wait. SIGTERM is skipped so a
 * child that ignored the first graceful signal does not get a second one.
 *
 * Windows: `taskkill /T /F`. `child.kill` is a `TerminateProcess` call whatever
 * the signal name, which on the `cmd.exe` shim path would kill the shim and
 * orphan the agent. `taskkill` failures are swallowed.
 */
export async function closeAgentSession(
  child: ChildProcess,
  exitPromise: Promise<ExitInfo>,
  gracefulExitMs: number,
  forceKillWaitMs: number
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === 'win32') {
    await forceKillWindowsTree(child, exitPromise, forceKillWaitMs);
    return;
  }

  try {
    child.kill('SIGINT');
  } catch {
    // child already gone between the check above and here
    return;
  }
  let escalation: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      exitPromise,
      new Promise<void>((resolve) => {
        escalation = setTimeout(resolve, gracefulExitMs);
      }),
    ]);
  } finally {
    if (escalation) clearTimeout(escalation);
  }
  if (child.exitCode !== null || child.signalCode !== null) return;

  try {
    child.kill('SIGKILL');
  } catch {
    /* child already gone */
  }
  await raceWithTimeout(exitPromise, forceKillWaitMs);
}

async function forceKillWindowsTree(
  child: ChildProcess,
  exitPromise: Promise<ExitInfo>,
  forceKillWaitMs: number
): Promise<void> {
  const pid = child.pid;
  // No pid means spawn itself failed, which the guard in `closeAgentSession`
  // normally short-circuits. Without one there is nothing to taskkill.
  if (pid !== undefined) {
    try {
      execSync(`taskkill /T /F /PID ${pid}`, {
        stdio: 'ignore',
        windowsHide: true,
        // Bound so a hung Windows shell can't block the orchestrator.
        timeout: 2_000,
      });
    } catch {
      /* taskkill missing, pid already dead, or timed out */
    }
  }
  await raceWithTimeout(exitPromise, forceKillWaitMs);
}

export async function raceWithTimeout(
  promise: Promise<unknown>,
  timeoutMs: number
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
