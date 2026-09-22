import { IoSnapshotStore, type IoSnapshots } from '../../native';
import { getDbConnection } from '../../utils/db-connection';
import { snapshotsOf, storedIoSnapshots } from '../../io-snapshots/outcome';

// One handle at a time: entries read for a request serve the next one while
// the commit and the set's digest hold, and a new commit or a re-imported set
// replaces it, so nothing accumulates over a long-lived daemon.
let remembered: IoSnapshots | undefined;

/** Keeps the set the resolve request just fetched, so hashing reuses it. */
export function rememberIoSnapshots(snapshots: IoSnapshots): void {
  remembered = snapshots;
}

/**
 * The set for `commit`. Getting it reads the one commit row to compare
 * digests, so a re-imported set is never served stale; the remembered set is
 * kept when they match, which is what preserves the entries it has read.
 */
export function getIoSnapshotsForCommit(
  commit: string | undefined
): IoSnapshots | undefined {
  if (!commit) {
    return undefined;
  }
  const stored = snapshotsOf(
    storedIoSnapshots(new IoSnapshotStore(getDbConnection()), commit)
  );
  if (
    stored &&
    remembered?.commit === commit &&
    remembered.resolution.digest === stored.resolution.digest
  ) {
    return remembered;
  }
  remembered = stored;
  return stored;
}
