export type DaemonMessage = {
  type: string;
  env?: Record<string, string>;
  /**
   * Stamped centrally by `DaemonSocketMessenger.sendMessage`, not by the ~30
   * sites that construct messages — hence optional. It can also be absent on a
   * message that predates the field, which is why `isForeignWorkspaceMessage`
   * treats `undefined` as "not foreign".
   */
  workspaceRoot?: string;
  data?: any;
};

export function isDaemonMessage(msg: unknown): msg is DaemonMessage {
  return typeof msg === 'object' && msg && 'type' in msg;
}

/**
 * Any message carrying the sender's workspace root. Structural so the checks
 * below serve both the daemon and the plugin worker without either module
 * importing the other's message type — `WorkspaceStampedMessage` in plugin
 * isolation is a separate declaration with a different shape, not an alias.
 *
 * `type` is required only so the type is not all-optional, which would accept
 * `{}`. It does not make the guard stricter at runtime.
 */
type WorkspaceScopedMessage = { type: string; workspaceRoot?: string };

/**
 * A receiver is scoped to the workspace that launched it, so a message from a
 * different one — two workspaces sharing an `NX_SOCKET_DIR` — must not be
 * processed. Compared directly; both come from the same resolution.
 */
export function isForeignWorkspaceMessage(
  msg: WorkspaceScopedMessage,
  receiverWorkspaceRoot: string
): boolean {
  if (msg.workspaceRoot === undefined) {
    return false;
  }
  return msg.workspaceRoot !== receiverWorkspaceRoot;
}

/**
 * Throws when a message came from a different workspace. The daemon catches this
 * to respond with the mismatch; the plugin worker catches it to drop the
 * message. `receiverDescription` names whichever one raised it.
 */
export function assertNotForeignWorkspaceMessage(
  msg: WorkspaceScopedMessage,
  receiverWorkspaceRoot: string,
  receiverDescription = `The Nx Daemon for '${receiverWorkspaceRoot}'`
): void {
  if (isForeignWorkspaceMessage(msg, receiverWorkspaceRoot)) {
    throw new Error(
      `${receiverDescription} received a message from a different workspace ('${msg.workspaceRoot}') and refused to process it. This usually means multiple workspaces are sharing a socket directory; ensure NX_SOCKET_DIR (or NX_DAEMON_SOCKET_DIR) is not set to a shared location.`
    );
  }
}
