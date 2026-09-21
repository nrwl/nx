import { readNxJson } from '../../config/configuration';
import type { IoSnapshotCloudOptions } from '../../io-snapshots/config';
import { fetchIoSnapshotsForRun } from '../../io-snapshots/fetch';
import type {
  HandleResolveIoSnapshotsMessage,
  ResolvedIoSnapshots,
} from '../message-types/resolve-io-snapshots';
import { rememberIoSnapshots } from './io-snapshots-state';

/**
 * Fetches this run's snapshot set and stores it, so the fetch and the write
 * happen once for every client the daemon serves. The handle stays here; the
 * client reads the stored set back for the commit this returns.
 */
export async function handleResolveIoSnapshots(
  payload: HandleResolveIoSnapshotsMessage
) {
  const resolved = await fetchIoSnapshotsForRun(
    readNxJson(),
    (payload.runnerOptions ?? {}) as IoSnapshotCloudOptions,
    payload.ioSnapshotEnv ?? {}
  );
  const response: ResolvedIoSnapshots = resolved
    ? {
        status: resolved.status,
        reason: resolved.reason,
        message: resolved.message,
        commit: resolved.commit ?? undefined,
      }
    : null;
  if (resolved) {
    rememberIoSnapshots(resolved);
  }
  // An object, not a string: the client returns what the socket layer
  // parsed, and a string body comes back parsed too, so stringifying here
  // only makes the shape depend on which side happens to parse.
  return { response, description: 'handleResolveIoSnapshots' };
}
