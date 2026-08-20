import { serverLogger } from '../logger';
import { outputsChangesInvalidatingGraphEnv } from './dotenv-graph-changes';
import {
  disableOutputsTracking,
  processFileChangesInOutputs,
} from './outputs-tracking';
import {
  currentProjectGraph,
  invalidateGraphCache,
  isKnownWorkspaceFile,
} from './project-graph-incremental-recomputation';
import type { FileWatcherCallback } from './watcher';

let outputsWatcherError: Error | undefined;
let outputsWatcherTerminalError: Error | undefined;

/**
 * The error a native outputs watcher failure delivered, if one has. Such an
 * error is terminal (the native watch loop exits after delivering it), so the
 * gitignored dotenv edits only that watcher reports stop arriving and a warm
 * graph would go stale silently. The server fails requests closed on it, like
 * a workspace watcher error.
 */
export function getOutputsWatcherTerminalError(): Error | undefined {
  return outputsWatcherTerminalError;
}

export const handleOutputsChanges: FileWatcherCallback = async (
  err,
  changeEvents
) => {
  try {
    if (err || !changeEvents || !changeEvents.length) {
      let error = typeof err === 'string' ? new Error(err) : err;
      serverLogger.watcherLog(
        'Unexpected outputs watcher error',
        error.message
      );
      console.error(error);
      outputsWatcherError = error;
      disableOutputsTracking();
      if (err) {
        // A native error is terminal: the watch loop has exited, so the
        // gitignored dotenv edits only this watcher reports stop arriving and
        // the graph invalidation below can never run again. Fail requests
        // closed like a workspace watcher error rather than serving a graph
        // that silently goes stale. The original error is preserved so an
        // inotify_add_watch failure still makes the client disable the daemon
        // and rebuild without it.
        outputsWatcherTerminalError = error;
      }
      return;
    }

    // A dotenv change that a task chain loads must refresh the graph so
    // createNodes re-resolves config reading process.env. This runs above the
    // outputsWatcherError guard: the two concerns are independent, and a
    // disabled outputs tracker must not leave the graph stale on a dotenv edit.
    // A change to a file the workspace watcher tracks already schedules a
    // recomputation that reads the new content; invalidating for it here too
    // would discard that recomputation at commit and force a second one. The
    // committed file map approximates what the watcher tracks: a file it does
    // not know is either gitignored (never reaches the workspace watcher, so it
    // needs the invalidation) or created since the last recompute (the watcher
    // handles it; the extra invalidation is fail-safe). Its own try/catch so a
    // fault here cannot trip the outputs-tracking kill switch below, which
    // belongs to an unrelated subsystem, and it fails safe by invalidating: a
    // stale graph on a dotenv edit is the bug this prevents.
    try {
      if (
        outputsChangesInvalidatingGraphEnv(
          changeEvents,
          currentProjectGraph
        ).some((path) => !isKnownWorkspaceFile(path))
      ) {
        invalidateGraphCache();
      }
    } catch (e) {
      serverLogger.watcherLog(
        'Failed to evaluate dotenv changes for graph invalidation; invalidating the graph cache to be safe',
        e instanceof Error ? e.message : String(e)
      );
      console.error(e);
      invalidateGraphCache();
    }

    if (outputsWatcherError) {
      return;
    }

    serverLogger.watcherLog('Processing file changes in outputs');
    processFileChangesInOutputs(changeEvents);
  } catch (err) {
    serverLogger.watcherLog(`Unexpected outputs watcher error`, err.message);
    console.error(err);
    outputsWatcherError = err;
    disableOutputsTracking();
  }
};
