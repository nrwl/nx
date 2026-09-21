export const RESOLVE_IO_SNAPSHOTS = 'RESOLVE_IO_SNAPSHOTS' as const;

export type HandleResolveIoSnapshotsMessage = {
  type: typeof RESOLVE_IO_SNAPSHOTS;
  runnerOptions: unknown;
  /**
   * The run's own values; the daemon's `process.env` predates the run. NOT
   * named `env`: the server reflects that field onto its whole process env
   * (`handleClientEnv`), deleting every key the message omits.
   */
  ioSnapshotEnv: {
    NX_IO_SNAPSHOTS?: string;
    NX_IO_SNAPSHOTS_MAX_AGE?: string;
    /** Decided by the run: the daemon's env may not carry CI at all. */
    ci?: boolean;
  };
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
