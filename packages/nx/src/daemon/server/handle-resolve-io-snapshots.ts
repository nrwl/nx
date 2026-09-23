import { readNxJson } from '../../config/configuration';
import type { IoSnapshotCloudOptions } from '../../io-snapshots/config';
import { loadIoSnapshotsForRun } from '../../io-snapshots/store';
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
  // An absent env (an older client) reads as not opted in, so snapshots stay
  // off rather than the daemon deciding from its own environment.
  const resolved = await loadIoSnapshotsForRun(
    readNxJson(),
    (payload.runnerOptions ?? {}) as IoSnapshotCloudOptions,
    payload.ioSnapshotEnv ?? {}
  );
  let response: ResolvedIoSnapshots = null;
  if (resolved?.status === 'skipped') {
    response = resolved;
  } else if (resolved) {
    response = {
      status: resolved.status,
      commit: resolved.snapshots.commit,
      fetchedAt: resolved.snapshots.resolution.fetchedAt,
    };
    rememberIoSnapshots(resolved.snapshots);
  }
  return { response, description: 'handleResolveIoSnapshots' };
}
