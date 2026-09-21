export const RESOLVE_IO_SNAPSHOTS = 'RESOLVE_IO_SNAPSHOTS' as const;

/**
 * The run's own values, NOT named `env`: the server reflects that field onto
 * its whole process env (`handleClientEnv`), deleting every key the message
 * omits. `ci` is decided by the run; the daemon's env predates it.
 */
export interface IoSnapshotEnvMessage {
  NX_IO_SNAPSHOTS?: string;
  NX_IO_SNAPSHOTS_MAX_AGE?: string;
  ci?: boolean;
}

export type HandleResolveIoSnapshotsMessage = {
  type: typeof RESOLVE_IO_SNAPSHOTS;
  runnerOptions: unknown;
  ioSnapshotEnv: IoSnapshotEnvMessage;
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
