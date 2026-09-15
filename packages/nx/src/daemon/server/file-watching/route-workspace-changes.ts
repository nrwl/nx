import type { ChangeBatch } from '../../../native';
import { serverLogger } from '../../logger';
import { scheduleProjectGraphRecomputation } from '../project-graph-incremental-recomputation';

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
 * The context already consulted the disk: directories and vanished files are
 * gone from the batch, deleted directories are expanded to their files, and
 * every created or updated file carries its new hash.
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

  const hashes: Record<string, string> = {};
  for (const { file, hash } of batch.createdFiles) {
    hashes[file] = hash;
  }
  for (const { file, hash } of batch.updatedFiles) {
    hashes[file] = hash;
  }

  scheduleProjectGraphRecomputation(
    createdFiles,
    updatedFiles,
    deletedFiles,
    hashes
  );
}
