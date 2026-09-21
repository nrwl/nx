import type { NxJsonConfiguration } from '../config/nx-json';
import { daemonClient } from '../daemon/client/client';
import {
  loadIoSnapshots,
  skippedIoSnapshots,
  type IoSnapshots,
} from '../native';
import { getDbConnection } from '../utils/db-connection';
import {
  ioSnapshotEnv,
  isIoSnapshotFetchEnabled,
  type IoSnapshotCloudOptions,
} from './config';
import { fetchIoSnapshotsForRun, reportIoSnapshotResolution } from './fetch';

/**
 * This run's snapshot set. With the daemon, the daemon fetches it and writes
 * the database, and this process reads the stored set back for the commit the
 * daemon resolved: one fetch, shared by every client it serves. Without the
 * daemon this process does both. `null` means snapshots are not enabled here.
 */
export async function resolveIoSnapshotsForRun(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions
): Promise<IoSnapshots | null> {
  if (!daemonClient.enabled()) {
    return fetchIoSnapshotsForRun(nxJson, runnerOptions);
  }
  // Re-checked in the daemon, which reads nx.json itself; asking here keeps a
  // disabled workspace from paying for a round trip.
  if (!isIoSnapshotFetchEnabled(nxJson, runnerOptions)) {
    return null;
  }
  let resolved: Awaited<ReturnType<typeof daemonClient.resolveIoSnapshots>>;
  try {
    resolved = await daemonClient.resolveIoSnapshots(
      runnerOptions,
      ioSnapshotEnv()
    );
  } catch {
    // A daemon that cannot answer must not cost the run its snapshots.
    return fetchIoSnapshotsForRun(nxJson, runnerOptions);
  }
  if (!resolved) {
    return null;
  }
  if (!resolved.commit) {
    return reportIoSnapshotResolution(
      skippedIoSnapshots(resolved.reason, resolved.message)
    );
  }
  return reportIoSnapshotResolution(
    loadIoSnapshots(
      getDbConnection(),
      resolved.commit,
      resolved.reason || undefined,
      resolved.message || undefined
    )
  );
}
