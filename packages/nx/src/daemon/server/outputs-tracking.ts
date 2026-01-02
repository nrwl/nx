import { dirname } from 'path';
import { WatchEvent, getFilesForOutputs } from '../../native';
import { collapseExpandedOutputs } from '../../utils/collapse-expanded-outputs';
import { workspaceRoot } from '../../utils/workspace-root';

let disabled = false;

const dirsContainingOutputs = {} as { [dir: string]: Set<string> };
const recordedHashes = {} as { [output: string]: string };
const timestamps = {} as { [output: string]: number };
const numberOfExpandedOutputs = {} as { [hash: string]: number };

export function _recordOutputsHash(outputs: string[], hash: string) {
  numberOfExpandedOutputs[hash] = outputs.length;
  const now = Date.now();
  for (const output of outputs) {
    recordedHashes[output] = hash;
    timestamps[output] = now;

    // Optimize: calculate dirname once per iteration instead of twice
    let current = output;
    let parent = dirname(current);
    while (current !== parent) {
      dirsContainingOutputs[current] ??= new Set<string>();
      dirsContainingOutputs[current].add(output);
      current = parent;
      parent = dirname(current);
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

export function recordedHash(output: string) {
  return recordedHashes[output];
}

export function recordOutputsHash(_outputs: string[], hash: string) {
  // Early exit before expensive normalization
  if (disabled) return;
  const outputs = normalizeOutputs(_outputs);
  _recordOutputsHash(outputs, hash);
}

export function outputsHashesMatch(_outputs: string[], hash: string) {
  // Early exit before expensive normalization
  if (disabled) return false;
  const outputs = normalizeOutputs(_outputs);
  return _outputsHashesMatch(outputs, hash);
}

// Made synchronous - getFilesForOutputs is a sync Rust FFI call
function normalizeOutputs(outputs: string[]) {
  return collapseExpandedOutputs(getFilesForOutputs(workspaceRoot, outputs));
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
    // Optimize: calculate dirname once per iteration instead of twice
    let parent = dirname(current);
    while (current !== parent) {
      if (recordedHashes[current] && now - timestamps[current] > 2000) {
        recordedHashes[current] = undefined;
        break;
      }
      current = parent;
      parent = dirname(current);
    }
  }
}

export function disableOutputsTracking() {
  disabled = true;
}
