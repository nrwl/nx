import type { IoSnapshots } from '../native';

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

/** The set an outcome resolved to, if any. */
export function snapshotsOf(
  outcome: IoSnapshotOutcome | null
): IoSnapshots | undefined {
  return outcome && outcome.status !== 'skipped'
    ? outcome.snapshots
    : undefined;
}
