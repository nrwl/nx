import { readNxJson } from '../../config/configuration';
import type {
  IoSnapshotCloudOptions,
  IoSnapshotEnv,
} from '../../io-snapshots/config';
import {
  loadIoSnapshotsForRun,
  type IoSnapshotOutcome,
} from '../../io-snapshots/store';
import type {
  HandleResolveIoSnapshotsMessage,
  ResolvedIoSnapshots,
} from '../message-types/resolve-io-snapshots';
import { rememberIoSnapshots } from './io-snapshots-state';

/**
 * Fetches this run's snapshot set and stores it, so the fetch and the write
 * happen once for every client the daemon serves: clients that ask while a
 * fetch is under way share it, later ones read the stored set while it is
 * fresh. The handle stays here; the client reads back the version this returns.
 */
export async function handleResolveIoSnapshots(
  payload: HandleResolveIoSnapshotsMessage
) {
  // An absent env (an older client) reads as not opted in, so snapshots stay
  // off rather than the daemon deciding from its own environment.
  const resolved = await sharedLoad(
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

const inFlight = new Map<string, Promise<IoSnapshotOutcome | null>>();

/** Requests with the same options share one load; different credentials never do. */
function sharedLoad(
  runnerOptions: IoSnapshotCloudOptions,
  env: IoSnapshotEnv
): Promise<IoSnapshotOutcome | null> {
  const key = JSON.stringify([runnerOptions, env]);
  let pending = inFlight.get(key);
  if (!pending) {
    pending = loadIoSnapshotsForRun(readNxJson(), runnerOptions, env).finally(
      () => inFlight.delete(key)
    );
    inFlight.set(key, pending);
  }
  return pending;
}
