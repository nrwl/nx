import { loadIoSnapshots, type IoSnapshots } from '../../native';
import { getDbConnection } from '../../utils/db-connection';

// One handle at a time: entries read for a request serve the next one while
// the commit and the set's digest hold, and a new commit or a re-imported set
// replaces it, so nothing accumulates over a long-lived daemon.
let loaded: { commit: string; handle: IoSnapshots } | null = null;

/** Keeps the handle the resolve request just fetched, so hashing reuses it. */
export function rememberIoSnapshots(handle: IoSnapshots): void {
  const commit = handle.commit;
  loaded = commit ? { commit, handle } : null;
}

/**
 * The handle for `commit`. Loading reads the one commit row to compare
 * digests, so a re-imported set is never served stale; the handle in hand is
 * kept when they match, which is what preserves the entries it has read.
 */
export function ioSnapshotsForCommit(
  commit: string | undefined
): IoSnapshots | undefined {
  if (!commit) {
    return undefined;
  }
  const fresh = loadIoSnapshots(getDbConnection(), commit);
  if (
    loaded?.commit === commit &&
    loaded.handle.resolution?.digest === fresh.resolution?.digest
  ) {
    return loaded.handle;
  }
  loaded = { commit, handle: fresh };
  return fresh;
}
