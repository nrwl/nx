import type { IoSnapshots } from '../../native';
import { getIoSnapshotStore } from '../../io-snapshots/store';
import type { IoSnapshotVersion } from '../message-types/resolve-io-snapshots';

// One handle at a time: entries read for a request serve the next one while
// the version holds, and another version replaces it, so nothing accumulates
// over a long-lived daemon.
let remembered: IoSnapshots | undefined;

/** Keeps the set the resolve request just fetched, so hashing reuses it. */
export function rememberIoSnapshots(snapshots: IoSnapshots): void {
  remembered = snapshots;
}

/**
 * Exactly the version the client hashes from, never a newer import for the
 * same commit. `undefined` once that version has been pruned.
 */
export function getIoSnapshotsForVersion(
  version: IoSnapshotVersion | undefined
): IoSnapshots | undefined {
  if (!version) {
    return undefined;
  }
  if (
    remembered?.commit === version.commit &&
    remembered.resolution.fetchedAt === version.fetchedAt
  ) {
    return remembered;
  }
  const stored = readStored(version);
  if (stored) {
    remembered = stored;
  }
  return stored;
}

function readStored({
  commit,
  fetchedAt,
}: IoSnapshotVersion): IoSnapshots | undefined {
  try {
    return getIoSnapshotStore().getVersion(commit, fetchedAt) ?? undefined;
  } catch {
    // An unusable database hashes natively rather than failing the request.
    return undefined;
  }
}
