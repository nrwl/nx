// Cross-process mutual exclusion for the migrate run flow, built on the
// native flock-based FileLock (the same primitive the project graph uses to
// serialize nx processes): acquisition blocks until the holder releases, and
// the kernel releases a dead holder's lock automatically, so there is no
// stale-lock state to detect or clean up. Under WASM the native lock is
// unavailable and sections run unserialized, matching the project graph's
// IS_WASM guard for this lock. Not part of run/'s public surface (not
// re-exported via ./index): import directly within run/.
//
// Locked sections must stay synchronous. lock() blocks the whole thread, so
// if a holder parked on an await while a second in-process caller reached
// lock(), the holder's continuation could never run to release it. Git and
// child-process side effects belong outside the lock for the same reason.

import { randomBytes } from 'crypto';
import { mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { FileLock, IS_WASM } from '../../../native';
import {
  hasRunState,
  migrateRunsDir,
  readRunState,
  runDir,
  writeRunState,
  type MigrateRunState,
} from './run-state';

const STATE_LOCK_FILE_NAME = 'run.json.lock';
const CREATION_LOCK_FILE_NAME = 'init.lock';
const ACTIVITY_DIR_NAME = 'activity';

function withFileLock<T>(lockPath: string, fn: () => T): T {
  if (IS_WASM) {
    return fn();
  }
  const lock = new FileLock(lockPath);
  lock.lock();
  try {
    return fn();
  } finally {
    lock.unlock();
  }
}

/**
 * Runs `fn` while holding the run's state lock, releasing it afterwards even
 * if `fn` throws. writeRunState's tmp+rename gives per-write atomicity, but a
 * writer that reads state, applies an event, then writes still races a second
 * nx migrate process that read the same state first; this lock serializes
 * those sequences so the event always applies to the freshest on-disk state.
 */
export function withRunStateLock<T>(runDirPath: string, fn: () => T): T {
  return withFileLock(join(runDirPath, STATE_LOCK_FILE_NAME), fn);
}

/**
 * Serializes active-run discovery and run creation across nx migrate
 * processes. Two concurrent inits could otherwise both observe "no active
 * run" and create competing runs against the same workspace; the per-run
 * state lock cannot cover that window because the run directory does not
 * exist yet. Callers must redo their active-run check inside `fn`: a check
 * done before acquiring the lock may predate a concurrent creation.
 */
export function withRunCreationLock<T>(root: string, fn: () => T): T {
  const dir = migrateRunsDir(root);
  mkdirSync(dir, { recursive: true });
  return withFileLock(join(dir, CREATION_LOCK_FILE_NAME), fn);
}

/**
 * Reads the run state fresh under the lock, hands it to `apply`, and writes the
 * result back. `apply` returning null means "no change" and skips the write.
 * `apply` runs exactly once, synchronously, so it may capture out-params; a
 * corrupt or newer-format run.json propagates from the read.
 */
export function updateRunState(
  runDirPath: string,
  apply: (fresh: MigrateRunState) => MigrateRunState | null
): MigrateRunState {
  return withRunStateLock(runDirPath, () => {
    const fresh = readRunState(runDirPath);
    const next = apply(fresh);
    if (next === null) return fresh;
    writeRunState(runDirPath, next);
    return next;
  });
}

// The activity locks this process holds, one per run dir. Each is held until
// the process exits (the kernel releases it) or until this process deletes
// the run itself.
const heldActivity = new Map<string, FileLock>();

/**
 * Marks this process as acting on the run for the rest of its lifetime, so a
 * `--start-fresh` from another process refuses to delete the run under it.
 * The lock file is per process (`activity/<pid>-<nonce>.lock`): the master
 * session holds one for its whole agent session while the reconciles that
 * session runs hold their own. Registered under the creation lock, the same
 * gate deletion probes under, so a run cannot vanish between the run.json
 * check and the lock. No-op under WASM, where there is no native lock.
 */
export function holdRunActivity(root: string, runId: string): void {
  if (IS_WASM) return;
  const dir = runDir(root, runId);
  if (heldActivity.has(dir)) return;
  withRunCreationLock(root, () => {
    if (!hasRunState(dir)) {
      throw new Error(
        `Migrate run '${runId}' was deleted while this command was starting.`
      );
    }
    registerRunActivity(dir);
  });
}

/**
 * The hold without the creation lock: for the init that creates the run
 * inside its own creation-lock section, so the run is never discoverable
 * without a holder. Every other caller goes through holdRunActivity.
 */
export function registerRunActivity(dir: string): void {
  if (IS_WASM || heldActivity.has(dir)) return;
  const lock = new FileLock(
    join(
      dir,
      ACTIVITY_DIR_NAME,
      `${process.pid}-${randomBytes(4).toString('hex')}.lock`
    )
  );
  lock.lock();
  heldActivity.set(dir, lock);
}

// Drops this process's own hold. A process deleting a run is not mid-operation
// on it (entry points are synchronous and never nest), so its own hold says
// nothing about work in flight.
export function releaseRunActivity(dir: string): void {
  const lock = heldActivity.get(dir);
  if (lock === undefined) return;
  lock.unlock();
  heldActivity.delete(dir);
}

/**
 * Whether a live process holds an activity lock on the run. Files left by
 * dead holders are unlocked and count as free. Fails closed: a probe that
 * cannot be built or checked counts as live. Call under the creation lock.
 */
export function hasLiveRunActivity(dir: string): boolean {
  let names: string[];
  try {
    names = readdirSync(join(dir, ACTIVITY_DIR_NAME));
  } catch (e) {
    if (e?.code === 'ENOENT') return false;
    return true;
  }
  for (const name of names) {
    try {
      if (new FileLock(join(dir, ACTIVITY_DIR_NAME, name)).check()) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}
