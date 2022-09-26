import { lstat } from 'fs-extra';
import { dirname, join } from 'path';
import * as fastGlob from 'fast-glob';
import { workspaceRoot } from '../../utils/workspace-root';
import { collapseExpandedOutputs } from '../../utils/collapse-expanded-outputs';
import type { Event } from '@parcel/watcher';

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
  return (
    await Promise.all(outputs.map((o) => normalizeOutput(o, true)))
  ).flat();
}

async function normalizeOutput(
  output: string,
  expand: boolean
): Promise<string[]> {
  try {
    await lstat(join(workspaceRoot, output));
    return [output];
  } catch (e) {
    if (expand) {
      const expanded = collapseExpandedOutputs(
        await fastGlob(output, { cwd: workspaceRoot, dot: true })
      );
      return (
        await Promise.all(expanded.map((e) => normalizeOutput(e, false)))
      ).flat();
    } else {
      return [];
    }
  }
}

export function processFileChangesInOutputs(
  changeEvents: Event[],
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
