import type { ChangeBatch } from '../../../native';
import { serverLogger } from '../../logger';
import { scheduleAppliedChanges } from '../project-graph-incremental-recomputation';

const SUMMARY_CAP = 10;

function summarize(files: string[]): string {
  if (files.length === 0) return '(none)';
  if (files.length <= SUMMARY_CAP) {
    return files.map((f) => `  - ${f}`).join('\n');
  }
  return (
    files
      .slice(0, SUMMARY_CAP)
      .map((f) => `  - ${f}`)
      .join('\n') + `\n  ... and ${files.length - SUMMARY_CAP} more`
  );
}

/**
 * Route a batch the workspace context applied into the recomputation queue.
 */
export function routeWorkspaceChanges(batch: ChangeBatch): void {
  const createdFiles = batch.createdFiles.map(({ file }) => file);
  const updatedFiles = batch.updatedFiles.map(({ file }) => file);
  const deletedFiles = batch.deletedFiles;

  if (createdFiles.length || updatedFiles.length || deletedFiles.length) {
    serverLogger.watcherLog(
      `File changes detected (seq ${batch.seq}):\n` +
        `Created:\n${summarize(createdFiles)}\n` +
        `Updated:\n${summarize(updatedFiles)}\n` +
        `Deleted:\n${summarize(deletedFiles)}`
    );
  }

  scheduleAppliedChanges(batch);
}
