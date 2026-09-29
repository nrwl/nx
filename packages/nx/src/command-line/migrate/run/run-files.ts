// Every read, write, listing, removal and lock inside a migrate run folder goes
// through this module; nothing else calls `fs` on a run-folder path. The agent
// driving the run can write anywhere in the folder, so each operation requires
// every folder between the run folder and its target to be a real directory,
// and refuses a symlink or FIFO at the target. Not covered: the run folder
// itself and its ancestors, and an entry swapped between a check and the
// operation. The primitives come from agentic/handoff.ts, whose
// readHandoffWithReason, shared with the per-step flow, is the one reader built
// directly on them.

import {
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  type BigIntStats,
} from 'fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'path';
import { FileLock } from '../../../native';
import { parseJson } from '../../../utils/json';
import {
  FileReplacedDuringReadError,
  handoffsDirState,
  readInspectedFile,
} from '../agentic/handoff';
import { publishFileAtomically } from './atomic-write';

/** Thrown when a folder on the way to a run file is not a real directory. */
export class NotADirectoryError extends Error {
  constructor(dir: string) {
    super(
      `Remove '${basename(dir)}' from the migrate run and try again; nx needs a directory at ${dir}.`
    );
  }
}

// The folders from the run folder down to `dir`, which must be inside it.
function runFolderSegments(runDir: string, dir: string): string[] {
  const rel = relative(runDir, dir);
  if (rel === '') return [];
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(`${dir} is not inside the migrate run at ${runDir}.`);
  }
  return rel.split(sep);
}

/**
 * Throws when a folder is not a directory. With `create`, makes missing ones
 * without `recursive`, so a symlink created after the check fails with EEXIST
 * instead of being followed; without it, false at the first missing one.
 */
function walkRunFolders(
  runDir: string,
  segments: string[],
  create: boolean
): boolean {
  let dir = runDir;
  for (const segment of segments) {
    dir = join(dir, segment);
    const state = handoffsDirState(dir);
    switch (state) {
      case 'directory':
        break;
      case 'missing':
        if (!create) return false;
        mkdirSync(dir);
        break;
      case 'other':
        throw new NotADirectoryError(dir);
      default: {
        const unhandled: never = state;
        throw new Error(`Unhandled directory state: ${unhandled}`);
      }
    }
  }
  return true;
}

function checkFoldersTo(runDir: string, dir: string, create: boolean): boolean {
  return walkRunFolders(runDir, runFolderSegments(runDir, dir), create);
}

/** Creates `dir` and the folders above it inside the run, if missing. */
export function ensureRunFolder(runDir: string, dir: string): void {
  checkFoldersTo(runDir, dir, true);
}

const ATOMIC_READ_ATTEMPTS = 5;

/**
 * Reads a file its owner publishes atomically (tmp + rename), with
 * {@link readInspectedFile}'s refusal of a symlink or FIFO but tolerant of the
 * publish: a rename swaps the inode between the lstat and the open, read as a
 * replacement, so re-lstat and retry to read the new file. A pre-existing
 * symlink or FIFO fails the isFile check before any open; a file that keeps
 * changing past the retry budget is refused. Throws `notRegularMessage` for a
 * non-regular file; ENOENT, also for a missing folder on the way, and ELOOP
 * propagate.
 */
export function readRunFile(
  runDir: string,
  filePath: string,
  notRegularMessage = `${filePath} is not a regular file.`
): string {
  checkFoldersTo(runDir, dirname(filePath), false);
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

/** {@link readRunFile}, parsed; a parse error names the file. */
export function readRunJson<T extends object>(
  runDir: string,
  filePath: string
): T {
  const content = readRunFile(runDir, filePath);
  try {
    return parseJson<T>(content);
  } catch (e) {
    e.message = e.message.replace('JSON', filePath);
    throw e;
  }
}

/**
 * Publishes `content` through a temp file and a rename, creating missing
 * folders on the way. 'wx' fails the write on anything planted at the temp
 * name, and the rename replaces an entry at `filePath` without following it.
 */
export function writeRunFile(
  runDir: string,
  filePath: string,
  content: string
): void {
  checkFoldersTo(runDir, dirname(filePath), true);
  publishFileAtomically(filePath, (tmpPath) =>
    writeFileSync(tmpPath, content, { flag: 'wx' })
  );
}

/**
 * Removes the entry itself, never a symlink's target. Skipped when a folder on
 * the way is missing, is not a directory or cannot be inspected, so a removal
 * that must happen targets an entry directly in the run folder. A failed
 * removal throws.
 */
export function removeRunFile(runDir: string, filePath: string): void {
  const segments = runFolderSegments(runDir, dirname(filePath));
  try {
    if (!walkRunFolders(runDir, segments, false)) return;
  } catch {
    return;
  }
  rmSync(filePath, { force: true });
}

/** The entries of `dir`. Throws when it is not a directory. */
export function listRunFolder(runDir: string, dir: string): string[] {
  checkFoldersTo(runDir, dir, false);
  return readdirSync(dir);
}

/**
 * Whether something sits at `filePath`, a symlink included, so the read that
 * follows refuses it rather than reporting it absent. False when a folder on
 * the way is missing, is not a directory or cannot be inspected.
 */
export function runFileExists(runDir: string, filePath: string): boolean {
  const segments = runFolderSegments(runDir, dirname(filePath));
  try {
    return (
      walkRunFolders(runDir, segments, false) &&
      lstatSync(filePath, { throwIfNoEntry: false }) !== undefined
    );
  } catch {
    return false;
  }
}

/**
 * The entry's lstat, or null when it or a folder on the way is missing. Other
 * failures propagate rather than read as missing.
 */
export function lstatRunFile(
  runDir: string,
  filePath: string
): BigIntStats | null {
  if (!checkFoldersTo(runDir, dirname(filePath), false)) return null;
  try {
    return lstatSync(filePath, { bigint: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw e;
  }
}

/**
 * A lock on `filePath`. The native lock refuses only a symlink, and flock on a
 * FIFO fails in a way it reads as held forever, so anything but a regular file
 * is refused here.
 */
export function lockRunFile(runDir: string, filePath: string): FileLock {
  checkFoldersTo(runDir, dirname(filePath), true);
  const stat = lstatSync(filePath, { throwIfNoEntry: false });
  if (stat && !stat.isFile()) {
    throw new Error(`${filePath} is not a regular file.`);
  }
  return new FileLock(filePath);
}
