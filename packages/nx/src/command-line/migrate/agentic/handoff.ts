import { createHash } from 'crypto';
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
  let sanitized = value.replace(/[\x00-\x1f<>:"/\\|?*+]/g, '_');
  // Windows forbids trailing dots/spaces on file/directory names.
  sanitized = sanitized.replace(/[. ]+$/, '');
  if (WINDOWS_RESERVED_NAMES.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  return sanitized || '_';
}

const HANDOFF_NAME_PREFIX_MAX_BYTES = 64;

// Cuts on code points so a multibyte character is never split, and counts
// UTF-8 bytes because the filesystem limit is per byte, not per character.
function truncateUtf8(value: string, maxBytes: number): string {
  let out = '';
  let used = 0;
  for (const ch of value) {
    const bytes = Buffer.byteLength(ch);
    if (used + bytes > maxBytes) break;
    out += ch;
    used += bytes;
  }
  return out;
}

/**
 * Sanitizing folds many characters to `_`, so distinct migrations can share a
 * prefix. The SHA-256 of the raw package and name is what keeps their handoffs
 * collision-resistant.
 */
export function stepHandoffPath(
  runDir: string,
  migration: { package: string; name: string }
): string {
  const prefix = truncateUtf8(
    [...migration.package.split('/'), migration.name]
      .map(sanitizeSegment)
      .join('+'),
    HANDOFF_NAME_PREFIX_MAX_BYTES
  );
  const hash = createHash('sha256')
    .update(JSON.stringify([migration.package, migration.name]))
    .digest('hex');
  return join(runDir, HANDOFFS_DIR_NAME, `${prefix}-${hash}.json`);
}

/** Handoff path for a run step. No hash needed: step ids are unique within the run. */
export function runStepHandoffPath(runDir: string, stepId: string): string {
  return join(runDir, HANDOFFS_DIR_NAME, `${sanitizeSegment(stepId)}.json`);
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
 * `lstat`, not `stat`: a symlink in the handoffs dir's place would send every
 * handoff read and removal wherever it points. Handoff files sit directly
 * inside it, so this and the final component's own guard cover the whole path.
 */
export function handoffsDirState(
  handoffsDir: string
): 'directory' | 'missing' | 'other' {
  try {
    return lstatSync(handoffsDir).isDirectory() ? 'directory' : 'other';
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return 'missing';
    throw err;
  }
}

/**
 * Reads the file `stat` describes, refusing a symlink swapped in after the
 * caller's lstat: O_NOFOLLOW fails the open with ELOOP, and O_NONBLOCK keeps a
 * planted FIFO from blocking it. Windows has neither flag, so there the inode
 * comparison is what catches a followed symlink. It does not guard against an
 * unlink and recreate reusing the inode number. Read errors propagate: a file
 * the agent cannot read must not pass.
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
 * Splits "not written yet" from "written but garbage" so callers can surface a
 * malformed handoff instead of collapsing it into the generic
 * ambiguous-outcome prompt.
 */
export function readHandoffWithReason(
  filePath: string,
  handoffsDir: string
): HandoffReadResult {
  let raw: string;
  try {
    switch (handoffsDirState(handoffsDir)) {
      case 'missing':
        return { ok: false, reason: 'missing' };
      case 'other':
        return {
          ok: false,
          reason: 'read-error',
          detail: `${handoffsDir} is not a directory`,
        };
    }
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
export function readHandoff(
  filePath: string,
  handoffsDir: string
): HandoffFile | null {
  const result = readHandoffWithReason(filePath, handoffsDir);
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
  handoffsDir: string,
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
      if (readHandoff(handoffFilePath, handoffsDir) !== null) {
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
