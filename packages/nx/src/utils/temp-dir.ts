import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Directories we created and still want removed when the process exits. A dir
 * is removed from this set as soon as its `cleanup()` runs, so the exit handler
 * only ever touches dirs the caller forgot (or chose not) to clean up.
 */
const tracked = new Set<string>();
let exitHookRegistered = false;

function registerExitHook(): void {
  if (exitHookRegistered) {
    return;
  }
  exitHookRegistered = true;
  // 'exit' handlers must be synchronous - async work is ignored. This fires on
  // normal exit and `process.exit()`, but not on signals/crashes; in those
  // cases the OS reclaims the temp dir on its next sweep.
  process.once('exit', () => {
    for (const dir of tracked) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  });
}

export interface TempDir {
  /** Absolute path to the newly created temporary directory. */
  dir: string;
  /** Remove the directory now. Idempotent and safe to call more than once. */
  cleanup: () => void;
}

/**
 * Creates a unique directory under the OS temp dir and registers it for removal
 * when the process exits. Prefer calling `cleanup()` as soon as the directory
 * is no longer needed; the exit hook is only a safety net for dirs that must
 * outlive the calling function (and is best-effort - see `registerExitHook`).
 */
export function createTempDir(prefix = 'nx-'): TempDir {
  registerExitHook();
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tracked.add(dir);

  const cleanup = () => {
    if (!tracked.delete(dir)) {
      return;
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  };

  return { dir, cleanup };
}
