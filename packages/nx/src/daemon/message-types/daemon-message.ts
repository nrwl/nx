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
 * A daemon is scoped to the workspace that launched it. A message whose
 * `workspaceRoot` differs from the daemon's own root came from a different
 * workspace (e.g. two workspaces sharing an `NX_SOCKET_DIR`) and must not be
 * processed. Both values are produced from the same workspace-root resolution,
 * so they are compared directly.
 */
export function isForeignWorkspaceMessage(
  msg: DaemonMessage,
  daemonWorkspaceRoot: string
): boolean {
  if (msg.workspaceRoot === undefined) {
    return false;
  }
  return msg.workspaceRoot !== daemonWorkspaceRoot;
}

/**
 * Asserts that a message is safe for this daemon to process. Throws when the
 * message originated from a different workspace so the caller can surface the
 * mismatch details to the client and refuse the request.
 */
export function assertValidDaemonMessage(
  msg: DaemonMessage,
  daemonWorkspaceRoot: string
): void {
  if (isForeignWorkspaceMessage(msg, daemonWorkspaceRoot)) {
    throw new Error(
      `The Nx Daemon for '${daemonWorkspaceRoot}' received a message from a different workspace ('${msg.workspaceRoot}') and refused to process it. This usually means multiple workspaces are sharing a socket directory; ensure NX_SOCKET_DIR (or NX_DAEMON_SOCKET_DIR) is not set to a shared location.`
    );
  }
}
