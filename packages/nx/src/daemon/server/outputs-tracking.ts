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

export function recordedHash(output: string) {
  return recordedHashes[output];
}

export async function recordOutputsHash(_outputs: string[], hash: string) {
  const outputs = await normalizeOutputs(_outputs);
  if (disabled) return;
  _recordOutputsHash(outputs, hash);
}

export async function outputsHashesMatch(_outputs: string[], hash: string) {
  const outputs = await normalizeOutputs(_outputs);
  if (disabled) return false;
  return _outputsHashesMatch(outputs, hash);
}

async function normalizeOutputs(outputs: string[]) {
  let expandedOutputs = collapseExpandedOutputs(
    getFilesForOutputs(workspaceRoot, outputs)
  );
  return expandedOutputs;
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

export function disableOutputsTracking() {
  disabled = true;
}
