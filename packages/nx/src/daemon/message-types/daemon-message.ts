export type DaemonMessage = {
  type: string;
  env?: Record<string, string>;
  /**
   * The workspace root of the sending client. This is NOT set by the many call
   * sites that construct messages (they build `{ type, ... }` literals without
   * it); it is stamped centrally by `DaemonSocketMessenger.sendMessage` just
   * before the message goes over the socket. It is therefore optional at the
   * type level: making it required would force ~30 construction sites to set a
   * value that the transport layer immediately overwrites. It can also be
   * absent on a received message that predates this field or that did not come
   * through the messenger, which is why `isForeignWorkspaceMessage` treats
   * `undefined` as "not foreign" rather than rejecting it.
   */
  workspaceRoot?: string;
  data?: any;
};

export function isDaemonMessage(msg: unknown): msg is DaemonMessage {
  return typeof msg === 'object' && msg && 'type' in msg;
}

/**
 * Any message that carries the sending process's workspace root. The Nx daemon
 * (`DaemonMessage`) and the plugin-worker protocol (`WorkspaceScopedMessage` in
 * plugin isolation) both stamp this field so the receiver can reject messages
 * from a different workspace. Typed structurally here so the shared checks below
 * apply to both without either module depending on the other's message type.
 */
type WorkspaceScopedMessage = { workspaceRoot?: string };

/**
 * A socket receiver (the daemon, or a plugin worker) is scoped to the workspace
 * that launched it. A message whose `workspaceRoot` differs from the receiver's
 * own root came from a different workspace (e.g. two workspaces sharing an
 * `NX_SOCKET_DIR`) and must not be processed. Both values are produced from the
 * same workspace-root resolution, so they are compared directly. An undefined
 * `workspaceRoot` (unstamped or legacy message) is treated as "not foreign".
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
 * Asserts that a message is safe for its receiver to process, throwing when it
 * originated from a different workspace. Shared by the Nx daemon and the plugin
 * workers: both listen on a socket that a process from another workspace could
 * reach (e.g. via a shared `NX_SOCKET_DIR`) and must refuse those messages. The
 * daemon catches this to respond to the client with the mismatch; the plugin
 * worker catches it to drop the message. `receiverDescription` names the
 * receiver in the error so it reads correctly for whichever one raised it.
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
