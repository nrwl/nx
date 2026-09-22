export const RESOLVE_IO_SNAPSHOTS = 'RESOLVE_IO_SNAPSHOTS' as const;

/**
 * The run's own values, NOT named `env`: the server reflects that field onto
 * its whole process env (`handleClientEnv`), deleting every key the message
 * omits. They travel with the request because the daemon's own environment
 * predates the run, so its `NX_IO_SNAPSHOTS` may differ or be absent.
 */
export interface IoSnapshotEnvMessage {
  NX_IO_SNAPSHOTS?: string;
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
