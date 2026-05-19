import { statSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '../../../utils/workspace-root';
import type { WatchEvent } from '../../../native';
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
 * Categorise a batch of watcher events by type and route them into the
 * recomputation queue. Deletions are taken at face value; created and
 * updated paths are stat'd to skip directories (the project graph only
 * cares about files). A stat error means the file was unlinked between
 * the watcher firing and us looking — drop the event.
 */
export function routeWorkspaceChanges(events: WatchEvent[]): void {
  serverLogger.watcherLog(
    `[watcher] routeWorkspaceChanges batch: ${events.length} events: ` +
      events.map((e) => `${e.type}:${e.path}`).join(', ')
  );

  const updatedFilesToHash: string[] = [];
  const createdFilesToHash: string[] = [];
  const deletedFiles: string[] = [];
  const droppedDirs: string[] = [];
  const droppedStatErrors: string[] = [];

  for (const event of events) {
    if (event.type === 'delete') {
      deletedFiles.push(event.path);
      continue;
    }
    try {
      const s = statSync(join(workspaceRoot, event.path));
      if (!s.isFile()) {
        droppedDirs.push(event.path);
        continue;
      }
      if (event.type === 'update') {
        updatedFilesToHash.push(event.path);
      } else {
        createdFilesToHash.push(event.path);
      }
    } catch (e) {
      droppedStatErrors.push(
        `${event.path} (${e instanceof Error ? e.message : String(e)})`
      );
      // File deleted between watcher emit and stat — drop it.
    }
  }

  if (
    createdFilesToHash.length ||
    updatedFilesToHash.length ||
    deletedFiles.length ||
    droppedDirs.length ||
    droppedStatErrors.length
  ) {
    serverLogger.watcherLog(
      `File changes detected:\n` +
        `Created:\n${summarize(createdFilesToHash)}\n` +
        `Updated:\n${summarize(updatedFilesToHash)}\n` +
        `Deleted:\n${summarize(deletedFiles)}` +
        (droppedDirs.length
          ? `\nDropped (dirs):\n${summarize(droppedDirs)}`
          : '') +
        (droppedStatErrors.length
          ? `\nDropped (stat errors):\n${summarize(droppedStatErrors)}`
          : '')
    );
  }

  scheduleProjectGraphRecomputation(
    createdFilesToHash,
    updatedFilesToHash,
    deletedFiles
  );
}
