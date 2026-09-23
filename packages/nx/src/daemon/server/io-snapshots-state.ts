import type { IoSnapshots } from '../../native';
import { getIoSnapshotStore } from '../../io-snapshots/store';

// One handle at a time: entries read for a request serve the next one while
// the commit and its import hold, and a new commit or a re-imported set
// replaces it, so nothing accumulates over a long-lived daemon.
let remembered: IoSnapshots | undefined;

/** Keeps the set the resolve request just fetched, so hashing reuses it. */
export function rememberIoSnapshots(snapshots: IoSnapshots): void {
  remembered = snapshots;
}

/**
 * The set for `commit`. Getting it reads the one commit row to compare fetch
 * times, so a re-imported set is never served stale; the remembered set is
 * kept when they match, which is what preserves the entries it has read.
 */
export function getIoSnapshotsForCommit(
  commit: string | undefined
): IoSnapshots | undefined {
  if (!commit) {
    return undefined;
  }
  const stored = getIoSnapshotStore().get(commit) ?? undefined;
  if (
    stored &&
    remembered?.commit === commit &&
    remembered.resolution.fetchedAt === stored.resolution.fetchedAt
  ) {
    return remembered;
  }
  remembered = stored;
  return stored;
}
