import type { NxJsonConfiguration } from '../config/nx-json';
import { daemonClient } from '../daemon/client/client';
import type { IoSnapshotVersion } from '../daemon/message-types/resolve-io-snapshots';
import {
  ioSnapshotEnv,
  isIoSnapshotFetchEnabled,
  type IoSnapshotCloudOptions,
} from './config';
import {
  getIoSnapshotStore,
  loadIoSnapshotsForRun,
  reportIoSnapshotResolution,
  skippedIoSnapshots,
  type IoSnapshotOutcome,
} from './store';

/**
 * This run's snapshot set. With the daemon, the daemon fetches it and writes
 * the database, and this process reads back the version the daemon resolved:
 * one fetch, shared by every client it serves. Without the
 * daemon this process does both. `null` means snapshots are not enabled here.
 */
export async function resolveIoSnapshotsForRun(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions
): Promise<IoSnapshotOutcome | null> {
  if (!daemonClient.enabled()) {
    return loadIoSnapshotsForRun(nxJson, runnerOptions);
  }
  // Re-checked in the daemon, which reads nx.json itself; asking here keeps a
  // disabled workspace from paying for a round trip.
  if (!isIoSnapshotFetchEnabled(nxJson, runnerOptions)) {
    return null;
  }
  // `undefined` is a daemon that could not answer; `null` is one whose own
  // gate said snapshots are off.
  const resolved = await daemonClient
    .resolveIoSnapshots(runnerOptions, ioSnapshotEnv())
    .catch(() => undefined);
  if (resolved === undefined) {
    // A daemon that cannot answer must not cost the run its snapshots.
    return loadIoSnapshotsForRun(nxJson, runnerOptions);
  }
  if (resolved === null) {
    return null;
  }
  if (resolved.status === 'skipped') {
    return reportIoSnapshotResolution(resolved);
  }
  return reportIoSnapshotResolution(storedOutcome(resolved));
}

/** The version the daemon resolved, read back from the store this process opens. */
function storedOutcome({
  status,
  commit,
  fetchedAt,
}: IoSnapshotVersion & { status: 'fetched' | 'cached' }): IoSnapshotOutcome {
  try {
    const snapshots = getIoSnapshotStore().getVersion(commit, fetchedAt);
    return snapshots
      ? { status, snapshots }
      : skippedIoSnapshots(
          'no-set',
          `no I/O snapshot set is stored for ${commit}`
        );
  } catch (e) {
    // An unusable database costs the run its snapshots, never the run.
    return skippedIoSnapshots(
      'store-unavailable',
      e instanceof Error ? e.message : String(e)
    );
  }
}
