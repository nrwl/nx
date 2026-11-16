import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  type BigIntStats,
} from 'fs';
import { join } from 'path';
import { HANDOFFS_DIR_NAME, HandoffFile } from './types';

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

// Truncates to a UTF-8 byte budget without splitting a code point.
export function truncateUtf8(value: string, maxBytes: number): string {
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

// Step ids match run-state's STEP_ID (`step-<n>`), so they are safe file names.
export function runStepHandoffPath(runDir: string, stepId: string): string {
  return join(runDir, HANDOFFS_DIR_NAME, `${stepId}.json`);
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
 * handoff read and removal wherever it points.
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
 * Non-recursive mkdir: the run dir exists, and a symlink created after the
 * missing-path check fails with EEXIST instead of being followed.
 */
export function ensureRunSubdir(dir: string, notADirectory: () => Error): void {
  const state = handoffsDirState(dir);
  switch (state) {
    case 'directory':
      return;
    case 'missing':
      mkdirSync(dir);
      return;
    case 'other':
      throw notADirectory();
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled directory state: ${unhandled}`);
    }
  }
}

/**
 * Thrown by {@link readInspectedFile} when the opened descriptor is not the
 * file the caller's lstat described: a symlink followed on Windows, or an
 * atomic replacement between the lstat and the open.
 */
export class FileReplacedDuringReadError extends Error {}

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
      throw new FileReplacedDuringReadError(replacedMessage);
    }
    return readFileSync(fd, 'utf-8');
  } finally {
    closeSync(fd);
  }
}

const ATOMIC_READ_ATTEMPTS = 5;

/**
 * Reads a file its owner publishes atomically (tmp + rename), with
 * {@link readInspectedFile}'s refusal of a symlink or FIFO but tolerant of the
 * publish: a rename swaps the inode between the lstat and the open, read as a
 * replacement, so re-lstat and retry to read the new file. A pre-existing
 * symlink or FIFO fails the isFile check before any open; a file that keeps
 * changing past the retry budget is refused. Throws `notRegularMessage` for a
 * non-regular file; ENOENT and ELOOP propagate.
 */
export function readAtomicallyPublishedFile(
  filePath: string,
  notRegularMessage: string
): string {
  for (let attempt = 1; ; attempt++) {
    const stat = lstatSync(filePath, { bigint: true });
    if (!stat.isFile()) {
      throw new Error(notRegularMessage);
    }
    try {
      return readInspectedFile(
        filePath,
        stat,
        `${filePath} was replaced while being read.`
      );
    } catch (e) {
      if (
        e instanceof FileReplacedDuringReadError &&
        attempt < ATOMIC_READ_ATTEMPTS
      ) {
        continue;
      }
      throw e;
    }
  }
}

/**
 * Splits "not written yet" from "written but garbage" so callers can surface a
 * malformed handoff instead of treating it as not written.
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
