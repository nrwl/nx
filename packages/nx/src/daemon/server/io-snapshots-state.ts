import { IoSnapshotStore, type IoSnapshots } from '../../native';
import { getDbConnection } from '../../utils/db-connection';

// One handle at a time: entries read for a request serve the next one while
// the commit and the set's digest hold, and a new commit or a re-imported set
// replaces it, so nothing accumulates over a long-lived daemon.
let loaded: IoSnapshots | null = null;

/** Keeps the set the resolve request just fetched, so hashing reuses it. */
export function rememberIoSnapshots(snapshots: IoSnapshots): void {
  loaded = snapshots;
}

/**
 * The set for `commit`. Getting it reads the one commit row to compare
 * digests, so a re-imported set is never served stale; the handle in hand is
 * kept when they match, which is what preserves the entries it has read.
 */
export function getIoSnapshotsForCommit(
  commit: string | undefined
): IoSnapshots | undefined {
  if (!commit) {
    return undefined;
  }
  let fresh: IoSnapshots | null;
  try {
    fresh = new IoSnapshotStore(getDbConnection()).get(commit);
  } catch {
    fresh = null;
  }
  if (
    fresh &&
    loaded?.commit === commit &&
    loaded.resolution.digest === fresh.resolution.digest
  ) {
    return loaded;
  }
  loaded = fresh;
  return fresh ?? undefined;
}
