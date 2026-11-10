// Cross-process mutual exclusion for the migrate run flow, built on the
// native flock-based FileLock (the same primitive the project graph uses to
// serialize nx processes): acquisition blocks until the holder releases, and
// the kernel releases a dead holder's lock automatically, so there is no
// stale-lock state to detect or clean up. Under WASM the native lock is
// unavailable and sections run unserialized, matching the project graph's
// IS_WASM guard for this lock. Only `isHeld` is part of run/'s public surface
// (re-exported via ./index): import the rest directly within run/.
//
// Locked sections must stay synchronous. lock() blocks the whole thread, so
// if a holder parked on an await while a second in-process caller reached
// lock(), the holder's continuation could never run to release it. Git and
// child-process side effects belong outside the lock for the same reason.

import { randomBytes } from 'crypto';
import { type Dirent, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { FileLock, IS_WASM } from '../../../native';
import { MIGRATE_RUNS_RELATIVE_DIR } from '../agentic/types';
import { singleLine } from '../text';
import {
  hasRunState,
  migrateRunsDir,
  readRunState,
  runDir,
  runKind,
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
// the process exits (the kernel releases it) or until this process releases
// it: deleting the run, or handing a continue off to the workspace-local nx.
const heldActivity = new Map<string, { lock: FileLock; name: string }>();

/**
 * Marks this process as acting on the run until it exits or releases the
 * hold, so a `--start-fresh` elsewhere refuses to delete it. One lock file per
 * process and run, taken under the creation lock that deletion probes under.
 * Refuses while another process works on a different run, which shares the
 * workspace. `exclusive` also refuses while another process holds this run,
 * even when this one already does. No-op under WASM, which has no native lock.
 */
export function holdRunActivity(
  root: string,
  runId: string,
  exclusive = false
): void {
  if (IS_WASM) return;
  const dir = runDir(root, runId);
  if (heldActivity.has(dir) && !exclusive) return;
  withRunCreationLock(root, () => {
    if (!hasRunState(dir)) {
      throw new Error(
        `Migrate run '${runId}' was deleted while this command was starting.`
      );
    }
    if (exclusive) {
      const others = liveRunActivityPids(dir);
      if (isHeld(others)) {
        throw heldRunError('continuing', runId, others);
      }
    }
    const [otherRun] = findOtherLiveRuns(root, runId);
    if (otherRun) {
      throw liveRunRefusal(`Not continuing migrate run '${runId}'`, otherRun);
    }
    registerRunActivity(dir);
  });
}

export interface LiveRun {
  dirName: string;
  // Reserved by an init that hasn't written run.json yet.
  starting: boolean;
  state: MigrateRunState | null;
  // Why run.json could not be read.
  readError?: unknown;
  holders: number[] | 'unknown';
}

/**
 * The runs other than `ownRunId` that another live process works on: runs
 * being started, active runs, `--run-migration` runs, and runs whose run.json
 * can't be read. A finished `--run-migrations` run doesn't count. Every run
 * changes the same workspace, so two live runs would install and commit over
 * each other.
 */
export function findOtherLiveRuns(root: string, ownRunId?: string): LiveRun[] {
  return listOtherRuns(root, ownRunId).filter((run) => isHeld(run.holders));
}

// findOtherLiveRuns' runs, including the ones no process holds.
export function listOtherRuns(root: string, ownRunId?: string): LiveRun[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(migrateRunsDir(root), { withFileTypes: true });
  } catch (e) {
    if (e?.code === 'ENOENT') return [];
    throw e;
  }
  const runs: LiveRun[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ownRunId) continue;
    const dir = join(migrateRunsDir(root), entry.name);
    const starting = !hasRunState(dir);
    // A directory without run.json that no process holds is an older nx's
    // agentic scratch, or what a dead init or an unfinished removal left.
    if (starting && !hasAnyLiveRunActivity(dir)) continue;
    let state: MigrateRunState | null = null;
    let readError: unknown;
    if (!starting) {
      try {
        state = readRunState(dir);
      } catch (e) {
        readError = e;
      }
      if (state && runKind(state) === 'finished') continue;
    }
    runs.push({
      dirName: entry.name,
      starting,
      state,
      readError,
      holders: liveRunActivityPids(dir),
    });
  }
  return runs;
}

/**
 * The refusal of a command that would change the workspace while another
 * process works on `run`. `refusal` opens it, as in "Not running the
 * migration".
 */
export function liveRunRefusal(refusal: string, run: LiveRun): Error {
  const path = `${MIGRATE_RUNS_RELATIVE_DIR}/${singleLine(run.dirName)}`;
  // Refused at once, never waited for: this process may be a git hook of the
  // init's checkpoint commit, which the init waits on.
  if (run.starting && run.holders !== 'unknown') {
    return new Error(
      `Another nx migrate process is starting a run (${path}). Wait for it to finish, then re-run the command.`
    );
  }
  const described = run.starting
    ? `the run being started in ${path}`
    : run.state?.singleMigration === true
      ? `an nx migrate --run-migration run (${path})`
      : `migrate run '${singleLine(run.dirName)}'`;
  if (run.holders !== 'unknown') {
    return new Error(
      `${refusal} while ${described} is in use: ${describeHolders(
        run.holders
      )}. Wait for it to end, then re-run the command.`
    );
  }
  return new Error(
    IS_WASM
      ? `${refusal}: the WASM build cannot tell whether another nx migrate process is working on ${described}. Re-run the command with the native nx binary, or make sure no nx migrate process is acting on it, remove ${path}, then re-run the command.`
      : `${refusal}: nx cannot tell whether another nx migrate process is working on ${described}. Make sure none is, remove ${path}, then re-run the command.`
  );
}

// 'unknown' is the fail-closed case: the activity folder could not be read or
// a lock could not be probed.
export function heldRunError(
  action: 'continuing' | 'deleting',
  runId: string,
  holders: number[] | 'unknown'
): Error {
  const refusal = `Not ${action} migrate run '${runId}'`;
  return new Error(
    holders === 'unknown'
      ? `${refusal}: nx cannot tell whether another nx migrate process is still working on it.`
      : `${refusal}: ${describeHolders(
          holders
        )} (an agent session, a reconcile, or a step). Wait for it to end, then re-run the command.`
  );
}

export function describeHolders(holders: number[]): string {
  return holders.length === 1
    ? `process ${holders[0]} is still working on it`
    : `processes ${holders.join(', ')} are still working on it`;
}

/**
 * The hold without the creation lock: for the init that creates the run
 * inside its own creation-lock section, so the run is never discoverable
 * without a holder. Every other caller goes through holdRunActivity.
 */
export function registerRunActivity(dir: string): void {
  if (IS_WASM || heldActivity.has(dir)) return;
  const name = `${process.pid}-${randomBytes(4).toString('hex')}.lock`;
  const lock = new FileLock(join(dir, ACTIVITY_DIR_NAME, name));
  lock.lock();
  heldActivity.set(dir, { lock, name });
}

export function releaseRunActivity(dir: string): void {
  const held = heldActivity.get(dir);
  if (held === undefined) return;
  held.lock.unlock();
  heldActivity.delete(dir);
}

/**
 * The pids of the other live processes holding the run, from their lock
 * names. This process's own hold is skipped: a deleting init may hold the run
 * from its report or preflight, which is not competing work. Locks left by
 * dead holders are free. 'unknown' under WASM, and when the folder cannot be
 * listed, a lock cannot be probed, or a held lock's name carries no pid.
 */
export function liveRunActivityPids(dir: string): number[] | 'unknown' {
  if (IS_WASM) return 'unknown';
  const names = liveActivityNames(dir, heldActivity.get(dir)?.name);
  if (names === 'unknown') return 'unknown';
  const pids = names.map((name) => Number(name.split('-', 1)[0]));
  return pids.every((pid) => Number.isInteger(pid) && pid > 0)
    ? pids
    : 'unknown';
}

/**
 * Whether any live process, this one included, holds an activity lock on the
 * run: for the discovery that treats a held directory without run.json as a
 * run being started, whichever process is starting it. Fails closed, so under
 * WASM any lock file counts.
 */
export function hasAnyLiveRunActivity(dir: string): boolean {
  return isHeld(liveActivityNames(dir, undefined));
}

// Whether a run's holders or held lock names show it held; 'unknown' counts.
export function isHeld(holders: readonly unknown[] | 'unknown'): boolean {
  return holders === 'unknown' || holders.length > 0;
}

// The names of the held lock files other than `skip`; 'unknown' when the
// folder cannot be listed or a lock cannot be probed, as under WASM.
function liveActivityNames(
  dir: string,
  skip: string | undefined
): string[] | 'unknown' {
  let names: string[];
  try {
    names = readdirSync(join(dir, ACTIVITY_DIR_NAME));
  } catch (e) {
    if (e?.code === 'ENOENT') return [];
    return 'unknown';
  }
  const held: string[] = [];
  for (const name of names) {
    if (name === skip) continue;
    try {
      if (new FileLock(join(dir, ACTIVITY_DIR_NAME, name)).check()) {
        held.push(name);
      }
    } catch {
      return 'unknown';
    }
  }
  return held;
}
