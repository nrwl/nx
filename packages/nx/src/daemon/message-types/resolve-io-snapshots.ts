export const RESOLVE_IO_SNAPSHOTS = 'RESOLVE_IO_SNAPSHOTS' as const;

/** Not named `env`: the daemon reflects `env` onto its whole process env (`handleClientEnv`). */
export interface IoSnapshotEnvMessage {
  NX_IO_SNAPSHOTS?: string;
}

export type HandleResolveIoSnapshotsMessage = {
  type: typeof RESOLVE_IO_SNAPSHOTS;
  runnerOptions: unknown;
  ioSnapshotEnv: IoSnapshotEnvMessage;
};

/** An `IoSnapshotOutcome` over the socket: the handle cannot cross it, its commit does. */
export type ResolvedIoSnapshots =
  | { status: 'fetched' | 'cached'; commit: string }
  | { status: 'skipped'; reason: string; message: string }
  | null;

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
