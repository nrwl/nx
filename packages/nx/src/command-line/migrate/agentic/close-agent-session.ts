import { ChildProcess, execSync } from 'child_process';

// How long to wait for the agent to exit gracefully after sending SIGINT.
// Long enough for an interactive agent to finish its current render and
// clean up; short enough that a frozen child still gets escalated in a
// sensible time.
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

// Merge window so a paired exit + error both land in the same ExitInfo
// (e.g. error from IPC followed by exit when the process actually
// terminates). For error-only paths like spawn ENOENT — where Node fires
// error but never exit — this timer is the SOLE settlement mechanism.
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
    // `error` fires when spawn itself fails (e.g. binary disappeared between
    // detection and run) OR alongside `exit` when the process started but
    // emitted an error event later. Treat both as an exit; field-merge so we
    // don't drop the loser's contribution when both fire.
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

  // POSIX path.
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

  // Graceful timeout elapsed without the agent exiting. SIGKILL is
  // uncatchable; bound the post-kill wait so a pathological uninterruptible
  // syscall can't hang us forever.
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
  // `child.pid` is undefined only when spawn itself failed; the early-return
  // guard in `closeAgentSession` should short-circuit that path. Reaching
  // here without a pid means a narrow race between the close trigger and
  // error-event propagation — without a pid we can't taskkill, so wait
  // briefly and return.
  if (pid !== undefined) {
    try {
      execSync(`taskkill /T /F /PID ${pid}`, {
        stdio: 'ignore',
        windowsHide: true,
        // Bound so a hung Windows shell can't block the orchestrator.
        timeout: 2_000,
      });
    } catch {
      /* taskkill missing, pid already dead, or timed out — fall through */
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
