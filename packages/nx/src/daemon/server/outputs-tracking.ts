import type { TaskOutputs } from '../../native';
import {
  outputsUnchangedInContext,
  recordOutputsInContext,
} from '../../utils/workspace-context';
import { workspaceRoot } from '../../utils/workspace-root';

let disabled = false;

/**
 * Whether the on-disk outputs of each entry are still what the daemon
 * recorded for its hash, so the cache copy can be skipped.
 */
export function outputsHashesMatchBatch(entries: TaskOutputs[]): boolean[] {
  if (disabled) return entries.map(() => false);
  return outputsUnchangedInContext(workspaceRoot, entries);
}

/**
 * Record each entry's outputs (the files it carries, or else what is on disk)
 * so future outputsHashesMatchBatch calls can skip redundant cache copies.
 */
export function recordOutputsHashBatch(entries: TaskOutputs[]) {
  if (disabled) return;
  recordOutputsInContext(workspaceRoot, entries);
}

export function disableOutputsTracking() {
  disabled = true;
}
