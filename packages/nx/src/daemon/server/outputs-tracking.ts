import { lstatSync } from 'fs';
import { dirname, join } from 'path';
import { WatchEvent, getFilesForOutputsBatch } from '../../native';
import { collapseExpandedOutputs } from '../../utils/collapse-expanded-outputs';
import { workspaceRoot } from '../../utils/workspace-root';

let disabled = false;

const dirsContainingOutputs = {} as { [dir: string]: Set<string> };
const recordedHashes = {} as { [output: string]: string };
const timestamps = {} as { [output: string]: number };
const numberOfExpandedOutputs = {} as { [hash: string]: number };
/** Files found under the outputs when the hash was recorded, per hash. */
const numberOfFiles = {} as { [hash: string]: number };
/** Hashes recorded before a watcher rescan; verified on their next check. */
const unverifiedHashes = new Set<string>();

export function _recordOutputsHash(
  outputs: string[],
  hash: string,
  fileCount: number = outputs.length
) {
  numberOfExpandedOutputs[hash] = outputs.length;
  numberOfFiles[hash] = fileCount;
  unverifiedHashes.delete(hash);
  for (const output of outputs) {
    recordedHashes[output] = hash;
    timestamps[output] = new Date().getTime();

    let current = output;
    while (current != dirname(current)) {
      if (!dirsContainingOutputs[current]) {
        dirsContainingOutputs[current] = new Set<string>();
      }
      dirsContainingOutputs[current].add(output);
      current = dirname(current);
    }
  }
}

export function _outputsHashesMatch(outputs: string[], hash: string) {
  if (outputs.length !== numberOfExpandedOutputs[hash]) {
    return false;
  } else {
    for (const output of outputs) {
      if (recordedHashes[output] !== hash) {
        return false;
      }
    }
  }
  return true;
}

/**
 * When the path was last written. A path that no longer exists is dated by
 * its nearest existing ancestor, whose mtime moved when the entry was removed.
 * Infinity if nothing up to the workspace root can be read.
 */
function lastModified(path: string): number {
  let current = path;
  while (true) {
    try {
      return lstatSync(join(workspaceRoot, current)).mtimeMs;
    } catch (e) {
      if (e?.code !== 'ENOENT' || current === dirname(current)) {
        return Infinity;
      }
      current = dirname(current);
    }
  }
}

export function processFileChangesInOutputs(changeEvents: WatchEvent[]) {
  for (let e of changeEvents) {
    let current = e.path;

    // the path is either an output itself or a parent
    if (dirsContainingOutputs[current]) {
      let modified: number;
      dirsContainingOutputs[current].forEach((output) => {
        if (recordedHashes[output]) {
          modified ??= lastModified(current);
          if (modified > timestamps[output]) {
            recordedHashes[output] = undefined;
          }
        }
      });
      continue;
    }

    // the path is a child of some output or unrelated
    while (current != dirname(current)) {
      if (recordedHashes[current]) {
        if (lastModified(e.path) > timestamps[current]) {
          recordedHashes[current] = undefined;
        }
        break;
      }
      current = dirname(current);
    }
  }
}

/**
 * Check whether the on-disk outputs of each entry still match the hash
 * the daemon recorded for them. Uses Rayon-parallel filesystem scanning
 * for uncached entries.
 */
export function outputsHashesMatchBatch(
  entries: { outputs: string[]; hash: string }[]
): boolean[] {
  if (disabled) return entries.map(() => false);

  // Fast path: skip filesystem scan for entries with no recorded hash.
  // _outputsHashesMatch will return false immediately if the hash isn't
  // in numberOfExpandedOutputs, so scanning the filesystem is wasted work.
  const needsScan: number[] = [];
  const results: boolean[] = new Array(entries.length);
  for (let i = 0; i < entries.length; i++) {
    if (numberOfExpandedOutputs[entries[i].hash] === undefined) {
      results[i] = false;
    } else {
      needsScan.push(i);
    }
  }

  if (needsScan.length > 0) {
    // Only scan outputs for entries that have recorded hashes
    const outputsBatch = needsScan.map((i) => entries[i].outputs);
    const expandedBatch = getFilesForOutputsBatch(workspaceRoot, outputsBatch);

    for (let j = 0; j < needsScan.length; j++) {
      const { hash } = entries[needsScan[j]];
      const expanded = collapseExpandedOutputs(expandedBatch[j]);
      let matches = _outputsHashesMatch(expanded, hash);
      if (matches && unverifiedHashes.has(hash)) {
        matches = _verifyRecordedOutputs(expandedBatch[j], expanded, hash);
        if (!matches) {
          for (const output of expanded) {
            recordedHashes[output] = undefined;
          }
        }
        unverifiedHashes.delete(hash);
      }
      results[needsScan[j]] = matches;
    }
  }

  return results;
}

/**
 * Record the hash of each entry's on-disk outputs so future
 * outputsHashesMatchBatch calls can skip redundant cache copies.
 * Uses Rayon-parallel filesystem scanning.
 */
export function recordOutputsHashBatch(
  entries: { outputs: string[]; hash: string }[]
) {
  if (disabled) return;

  const outputsBatch = entries.map((e) => e.outputs);
  const expandedBatch = getFilesForOutputsBatch(workspaceRoot, outputsBatch);

  for (let i = 0; i < entries.length; i++) {
    const expanded = collapseExpandedOutputs(expandedBatch[i]);
    _recordOutputsHash(expanded, entries[i].hash, expandedBatch[i].length);
  }
  _forgetUnreferencedHashes();
}

/**
 * Drop the per-hash records of hashes no output refers to any more. A record
 * for an output replaces the previous hash of that output, so a changed input
 * leaves behind a hash nothing can match; clearing on rescan used to be the
 * only thing that ever removed them.
 */
export function _forgetUnreferencedHashes() {
  const live = new Set(Object.values(recordedHashes));
  for (const store of [numberOfExpandedOutputs, numberOfFiles]) {
    for (const hash of Object.keys(store)) {
      if (!live.has(hash)) {
        delete store[hash];
      }
    }
  }
  for (const hash of unverifiedHashes) {
    if (!live.has(hash)) {
      unverifiedHashes.delete(hash);
    }
  }
}

/**
 * True if the files under the recorded outputs still match the record: the
 * same number of files, and no file or directory up to the recorded output
 * written after the record.
 */
export function _verifyRecordedOutputs(
  files: string[],
  outputs: string[],
  hash: string
) {
  if (files.length !== numberOfFiles[hash]) {
    return false;
  }
  const roots = new Set(outputs);
  const recordedAt = Math.min(...outputs.map((output) => timestamps[output]));
  if (Number.isNaN(recordedAt)) {
    return false;
  }
  const dirs = new Set<string>();
  for (const file of files) {
    if (lastModified(file) > recordedAt) {
      return false;
    }
    let dir = file;
    while (!roots.has(dir) && dir !== dirname(dir)) {
      dir = dirname(dir);
      if (dirs.has(dir)) {
        break;
      }
      dirs.add(dir);
    }
  }
  for (const dir of dirs) {
    if (lastModified(dir) > recordedAt) {
      return false;
    }
  }
  return true;
}

/**
 * Events were dropped, so every recorded hash is verified against the files
 * on its next check instead of being cleared. Hashes recorded afterwards are
 * trusted as usual, and the tracker keeps running.
 */
export function markRecordedOutputsHashesUnverified() {
  for (const hash of Object.keys(numberOfExpandedOutputs)) {
    unverifiedHashes.add(hash);
  }
}

export function disableOutputsTracking() {
  disabled = true;
}
