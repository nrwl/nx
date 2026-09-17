import { readNxJson } from '../../config/configuration';
import {
  fetchIoSnapshotsForRun,
  type IoSnapshotCloudOptions,
} from '../../io-snapshots/fetch';
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
    payload.env ?? {}
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
  return {
    response: JSON.stringify(response),
    description: 'handleResolveIoSnapshots',
  };
}
