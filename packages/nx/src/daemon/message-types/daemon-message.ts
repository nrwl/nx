export type DaemonMessage = {
  type: string;
  env?: Record<string, string>;
  workspaceRoot?: string;
  data?: any;
};

export function isDaemonMessage(msg: unknown): msg is DaemonMessage {
  return typeof msg === 'object' && msg && 'type' in msg;
}

/**
 * A daemon is scoped to the workspace that launched it. A message whose
 * `workspaceRoot` differs from the daemon's own root came from a different
 * workspace (e.g. two workspaces sharing an `NX_SOCKET_DIR`) and must not be
 * processed. The comparison is case-insensitive to match how the socket
 * directory is keyed off the workspace root.
 */
export function isForeignWorkspaceMessage(
  msg: DaemonMessage,
  daemonWorkspaceRoot: string
): boolean {
  return (
    msg.workspaceRoot !== undefined &&
    msg.workspaceRoot.toLowerCase() !== daemonWorkspaceRoot.toLowerCase()
  );
}
