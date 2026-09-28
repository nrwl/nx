import { serverLogger } from '../logger';
import {
  classifyDotEnvChanges,
  queuePendingDotEnvEvents,
} from './dotenv-graph-changes';
import { disableOutputsTracking } from './outputs-tracking';
import {
  currentProjectGraph,
  getRecomputationGeneration,
  invalidateGraphCache,
} from './project-graph-incremental-recomputation';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  trackedFilesInContext,
  type WatchEventsListener,
} from '../../utils/workspace-context';

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

export const handleOutputsChanges: WatchEventsListener = async (
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

    if (changeEvents.some((event) => event.type === 'rescan')) {
      // Dropped events cannot be classified: any gitignored dotenv file may
      // have changed unseen. Recorded outputs are compared by stamp, so they
      // need nothing.
      serverLogger.watcherLog(
        'The outputs watcher reported dropped events; invalidating the graph cache.'
      );
      invalidateGraphCache();
      return;
    }

    // A dotenv change that a task chain loads must refresh the graph so
    // createNodes re-resolves config reading process.env. A change to a file
    // the workspace watcher tracks already schedules a recomputation that
    // reads the new content; invalidating for it here too would discard that
    // recomputation at commit and force a second one. It is
    // queued instead of dropped: the two watchers deliver independently, so a
    // computation already in flight may have read the file before the edit,
    // and only the pre-serve replay can prove that. The context answers from
    // the files the watch keeps, so a path it does not hold is gitignored,
    // already deleted, or not yet ingested, and each of those needs the
    // invalidation. A missing context answers with nothing, which invalidates
    // too. Its own try/catch so a fault
    // here cannot trip the outputs-tracking kill switch below, which belongs
    // to an unrelated subsystem, and it fails safe by invalidating: a stale
    // graph on a dotenv edit is the bug this prevents.
    try {
      const { invalidating, unclassified } = classifyDotEnvChanges(
        changeEvents,
        currentProjectGraph
      );
      const generation = getRecomputationGeneration();
      queuePendingDotEnvEvents(
        unclassified.map((event) => event.path),
        generation
      );
      // Skips the napi call, which takes the files mutex and can wait out a
      // re-walk, for the common batch that classifies nothing.
      const knownInvalidating = invalidating.length
        ? trackedFilesInContext(workspaceRoot, invalidating)
        : [];
      queuePendingDotEnvEvents(knownInvalidating, generation);
      if (knownInvalidating.length < invalidating.length) {
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
  } catch (err) {
    serverLogger.watcherLog(`Unexpected outputs watcher error`, err.message);
    console.error(err);
    disableOutputsTracking();
  }
};
