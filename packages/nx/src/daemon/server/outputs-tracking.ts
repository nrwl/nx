import { dirname } from 'path';
import { WatchEvent, getFilesForOutputsBatch } from '../../native';
import { collapseExpandedOutputs } from '../../utils/collapse-expanded-outputs';
import { workspaceRoot } from '../../utils/workspace-root';

let disabled = false;

const dirsContainingOutputs = {} as { [dir: string]: Set<string> };
const recordedHashes = {} as { [output: string]: string };
const timestamps = {} as { [output: string]: number };
const numberOfExpandedOutputs = {} as { [hash: string]: number };

export function _recordOutputsHash(outputs: string[], hash: string) {
  numberOfExpandedOutputs[hash] = outputs.length;
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

export function processFileChangesInOutputs(
  changeEvents: WatchEvent[],
  now: number = undefined
) {
  if (!now) {
    now = new Date().getTime();
  }
  for (let e of changeEvents) {
    let current = e.path;

    // the path is either an output itself or a parent
    if (dirsContainingOutputs[current]) {
      dirsContainingOutputs[current].forEach((output) => {
        if (now - timestamps[output] > 2000) {
          recordedHashes[output] = undefined;
        }
      });
      continue;
    }

    // the path is a child of some output or unrelated
    while (current != dirname(current)) {
      if (recordedHashes[current] && now - timestamps[current] > 2000) {
        recordedHashes[current] = undefined;
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
      const expanded = collapseExpandedOutputs(expandedBatch[j]);
      results[needsScan[j]] = _outputsHashesMatch(
        expanded,
        entries[needsScan[j]].hash
      );
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
    _recordOutputsHash(expanded, entries[i].hash);
  }
}

export function disableOutputsTracking() {
  disabled = true;
}
