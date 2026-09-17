export const RESOLVE_IO_SNAPSHOTS = 'RESOLVE_IO_SNAPSHOTS' as const;

export type HandleResolveIoSnapshotsMessage = {
  type: typeof RESOLVE_IO_SNAPSHOTS;
  runnerOptions: unknown;
  /** The run's own values; the daemon's `process.env` predates the run. */
  env: { NX_IO_SNAPSHOTS?: string; NX_IO_SNAPSHOTS_MAX_AGE?: string };
};

/** What a resolved set looks like over the socket; the handle itself cannot cross it. */
export type ResolvedIoSnapshots = {
  status: string;
  reason: string;
  message: string;
  commit?: string;
} | null;

export function isHandleResolveIoSnapshotsMessage(
  message: unknown
): message is HandleResolveIoSnapshotsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === RESOLVE_IO_SNAPSHOTS
  );
}
