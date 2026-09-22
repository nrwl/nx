import type { IoSnapshotStore, IoSnapshots } from '../native';

/** What resolving this run's snapshot set came to. Only a set that resolved carries one. */
export type IoSnapshotOutcome =
  | { status: 'fetched' | 'cached'; snapshots: IoSnapshots }
  | { status: 'skipped'; reason: string; message: string };

export function skippedIoSnapshots(
  reason: string,
  message: string
): IoSnapshotOutcome {
  return { status: 'skipped', reason, message };
}

/** The set `store` holds for `commit`, as an outcome; never throws. */
export function storedIoSnapshots(
  store: IoSnapshotStore,
  commit: string
): IoSnapshotOutcome {
  try {
    const snapshots = store.get(commit);
    return snapshots
      ? { status: 'cached', snapshots }
      : skippedIoSnapshots(
          'no-bundle',
          `no I/O snapshot set is stored for ${commit}`
        );
  } catch (e) {
    return skippedIoSnapshots(reasonFromError(e), errorMessage(e));
  }
}

/** The set an outcome resolved to, if any. */
export function snapshotsOf(
  outcome: IoSnapshotOutcome | null
): IoSnapshots | undefined {
  return outcome && outcome.status !== 'skipped'
    ? outcome.snapshots
    : undefined;
}

const OFFLINE_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
]);

/** A skip reason from an error's `code`: the Nx Cloud client's or the store's. */
export function reasonFromError(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  if (typeof code !== 'string') return 'fetch-failed';
  if (OFFLINE_CODES.has(code)) return 'offline';
  return code.toLowerCase().replace(/_/g, '-');
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
