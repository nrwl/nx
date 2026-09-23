import { findAncestorNodeModules } from '../nx-cloud/resolution-helpers';
import {
  verifyOrUpdateNxCloudClient,
  type NxCloudClient,
} from '../nx-cloud/update-manager';
import { workspaceRoot } from '../utils/workspace-root';
import type { IoSnapshotCloudOptions } from './config';

const READ_TIMEOUT_MS = 10_000;

/** The Nx Cloud client's `readIoSnapshots` contract, as far as nx uses it. */
export interface ReadIoSnapshotsOptions {
  workspaceRoot?: string;
  nxCloudOptions?: IoSnapshotCloudOptions;
  timeoutMs?: number;
}

export interface ReadIoSnapshot {
  commit: string;
  inputs: readonly string[];
  outputs: readonly string[];
}

export interface ReadIoSnapshotsResult {
  /** Newest first; index 0 is HEAD. */
  commits: string[];
  snapshots: Readonly<Record<string, ReadIoSnapshot>>;
}

/**
 * Reads HEAD's snapshot set from Nx Cloud. Throws with a `code` saying why it
 * could not: the client's own, or `NO_CLOUD_CLIENT`, `UNSUPPORTED_CLIENT` or
 * `NO_SNAPSHOTS`.
 */
export async function fetchIoSnapshots(
  runnerOptions: IoSnapshotCloudOptions
): Promise<ReadIoSnapshotsResult> {
  const client = await loadCloudClient(runnerOptions).catch((e) => {
    throw codedError(
      'NO_CLOUD_CLIENT',
      e instanceof Error ? e.message : String(e)
    );
  });
  if (!client) {
    throw codedError(
      'NO_CLOUD_CLIENT',
      'The Nx Cloud client could not be loaded'
    );
  }
  if (typeof client.readIoSnapshots !== 'function') {
    throw codedError(
      'UNSUPPORTED_CLIENT',
      'The installed Nx Cloud client does not expose I/O snapshots; update nx-cloud'
    );
  }
  const result = await client.readIoSnapshots({
    workspaceRoot,
    nxCloudOptions: runnerOptions,
    timeoutMs: READ_TIMEOUT_MS,
  });
  if (!result) {
    // Today's server only answers `null` to a `knownUpdatedAt` nx never
    // sends; a client that means "nothing to serve" by it is not an error.
    throw codedError('NO_SNAPSHOTS', 'Nx Cloud returned no I/O snapshot set');
  }
  return result;
}

async function loadCloudClient(
  runnerOptions: IoSnapshotCloudOptions
): Promise<NxCloudClient | undefined> {
  const client = (await verifyOrUpdateNxCloudClient(runnerOptions))
    ?.nxCloudClient;
  client?.configureLightClientRequire()(findAncestorNodeModules(__dirname, []));
  return client;
}

function codedError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}
