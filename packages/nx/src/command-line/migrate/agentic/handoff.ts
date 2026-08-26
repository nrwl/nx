import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  type BigIntStats,
} from 'fs';
import { join } from 'path';
import { rsort } from 'semver';
import { normalizeVersion } from '../version-utils';
import {
  HANDOFFS_DIR_NAME,
  HandoffFile,
  MIGRATE_RUNS_RELATIVE_DIR,
} from './types';

/** Returns the run directory for a given workspace + run id (target version). */
export function runDirPath(workspaceRoot: string, runId: string): string {
  return join(workspaceRoot, MIGRATE_RUNS_RELATIVE_DIR, runId);
}

/** The version-derived run id: the highest target version in the plan. */
export function resolveAgenticRunId(
  migrations: ReadonlyArray<{ version: string }>
): string {
  return rsort(migrations.map((m) => normalizeVersion(m.version)))[0]!;
}

/**
 * `mkdir -p` with a contextual error wrapper. Without this, the raw
 * ENOSPC/EACCES/EROFS surfaces with no indication of which directory the
 * migrate orchestrator was trying to create.
 */
export function mkdirSafely(dir: string, purpose: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // `{ cause }` preserves the original ErrnoException so callers can read
    // `.cause.code`/`.cause.path`/`.cause.syscall` for targeted remediation.
    // Without it the only signal beyond the formatted message would be the
    // code string we splice in below.
    throw new Error(
      `Could not create ${purpose} at ${dir}${code ? ` (${code})` : ''}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err }
    );
  }
}

/**
 * Wipes any prior contents for this run id and recreates an empty directory.
 *
 * Scope of the wipe is intentionally narrow (only `<run-id>/`) so that handoff
 * artifacts from prior runs targeting different versions remain on disk for
 * inspection.
 */
export function initRunDir(workspaceRoot: string, runId: string): string {
  const dir = runDirPath(workspaceRoot, runId);
  rmSync(dir, { recursive: true, force: true });
  mkdirSafely(dir, 'nx migrate run directory');
  return dir;
}

// Windows reserved device names fail to open even with an extension —
// a migration named `CON` would otherwise produce a `CON.json` that the
// agent can't write to.
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * The bare `.` / `..` check must come first — otherwise a malformed migration
 * name of exactly `..` would let the handoff write escape the run directory.
 */
function sanitizeSegment(value: string): string {
  if (value === '.' || value === '..') return '_';
  let sanitized = value.replace(/[\x00-\x1f<>:"/\\|?*]/g, '_');
  // Windows forbids trailing dots/spaces on file/directory names.
  sanitized = sanitized.replace(/[. ]+$/, '');
  if (WINDOWS_RESERVED_NAMES.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  return sanitized || '_';
}

/**
 * Absolute path of the handoff file for a migration step within a run, under
 * the run directory's `handoffs/` subtree: the pre-authorized write scope
 * stops there, so a handoff placed anywhere else costs an approval prompt.
 * The package's scope (if any) becomes a real subdirectory so the package name
 * stays readable; two packages can ship a migration with the same name without
 * colliding because they land in different package subdirectories. Each
 * segment is sanitized so the path is always writable on every platform.
 */
export function stepHandoffPath(
  runDir: string,
  migration: { package: string; name: string }
): string {
  return join(
    runDir,
    HANDOFFS_DIR_NAME,
    ...migration.package.split('/').map(sanitizeSegment),
    `${sanitizeSegment(migration.name)}.json`
  );
}

export type HandoffReadFailureReason =
  | 'missing'
  | 'read-error'
  | 'parse-error'
  | 'shape-mismatch';

export type HandoffReadResult =
  | { ok: true; handoff: HandoffFile }
  | { ok: false; reason: HandoffReadFailureReason; detail?: string };

/**
 * Reads the regular file `stat` (a `lstatSync` result) describes, refusing to
 * follow a symlink swapped in after the lstat. The read goes through a
 * descriptor: O_NOFOLLOW makes such a symlink fail the open (ELOOP) instead
 * of being followed, and O_NONBLOCK stops a planted FIFO blocking the open
 * (same guard as owned-private-dir.ts). The inode comparison carries the
 * guarantee where the open flags cannot: Windows has neither flag, so a
 * followed symlink shows up only as its target's inode. A same-path unlink
 * and recreate can reuse the inode number and is not what this guards
 * against. Read errors propagate: a file the agent cannot read must not pass.
 */
export function readInspectedFile(
  filePath: string,
  stat: BigIntStats,
  replacedMessage: string
): string {
  const fd = openSync(
    filePath,
    fsConstants.O_RDONLY |
      (fsConstants.O_NOFOLLOW ?? 0) |
      (fsConstants.O_NONBLOCK ?? 0)
  );
  try {
    const fdStat = fstatSync(fd, { bigint: true });
    if (
      !fdStat.isFile() ||
      fdStat.dev !== stat.dev ||
      fdStat.ino !== stat.ino
    ) {
      throw new Error(replacedMessage);
    }
    return readFileSync(fd, 'utf-8');
  } finally {
    closeSync(fd);
  }
}

/**
 * Reads and validates a handoff file written by an agent. Returns a tagged
 * result so callers (the in-loop poller and the post-exit resolver) can
 * distinguish "file not yet written" from "file written but garbage" — the
 * latter is surfaced to the user instead of being collapsed into the same
 * generic ambiguous-outcome prompt.
 */
export function readHandoffWithReason(filePath: string): HandoffReadResult {
  let raw: string;
  try {
    const stat = lstatSync(filePath, { bigint: true });
    if (!stat.isFile()) {
      return {
        ok: false,
        reason: 'read-error',
        detail: `${filePath} is not a regular file`,
      };
    }
    raw = readInspectedFile(
      filePath,
      stat,
      `${filePath} was replaced while being read`
    );
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return { ok: false, reason: 'missing' };
    return {
      ok: false,
      reason: 'read-error',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      reason: 'parse-error',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).summary !== 'string'
  ) {
    return { ok: false, reason: 'shape-mismatch' };
  }
  const obj = parsed as Record<string, unknown>;
  const status = obj.status;
  const summary = obj.summary;
  if (status !== 'success' && status !== 'failed') {
    return { ok: false, reason: 'shape-mismatch' };
  }
  // Null-prototype object guards against a prototype-pollution gadget:
  // JSON.parse materializes `__proto__` as an own enumerable property, and
  // a rest-spread would carry it through to wherever extras gets merged.
  const extras: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(obj)) {
    if (key === 'status' || key === 'summary') continue;
    extras[key] = obj[key];
  }
  const handoff: HandoffFile = { status, summary: summary as string };
  if (Object.keys(extras).length > 0) {
    handoff.extras = extras;
  }
  return { ok: true, handoff };
}

/**
 * Convenience wrapper preserving the original null-on-any-failure contract.
 * Used by the polling loop (`waitForValidHandoff`) where every failure mode
 * is "keep waiting" — the file may be missing, mid-write, or being rewritten.
 */
export function readHandoff(filePath: string): HandoffFile | null {
  const result = readHandoffWithReason(filePath);
  return result.ok ? result.handoff : null;
}

/**
 * Polls for a valid handoff file. Resolves once `readHandoff` accepts the
 * file's contents. Used to detect when the agent has finished its work so the
 * orchestrator can close the agent's session without depending on the agent
 * exiting on its own.
 *
 * Rejects with the abort reason when `options.signal` is aborted.
 */
export function waitForValidHandoff(
  handoffFilePath: string,
  options: { intervalMs?: number; signal?: AbortSignal } = {}
): Promise<void> {
  const intervalMs = options.intervalMs ?? 500;
  const { signal } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'));
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(signal!.reason ?? new Error('aborted'));
    };
    const tick = () => {
      if (signal?.aborted) {
        onAbort();
        return;
      }
      if (readHandoff(handoffFilePath) !== null) {
        signal?.removeEventListener('abort', onAbort);
        resolve();
        return;
      }
      timer = setTimeout(tick, intervalMs);
    };
    signal?.addEventListener('abort', onAbort);
    timer = setTimeout(tick, intervalMs);
  });
}
