import { posix, win32 } from 'node:path';

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
 * below serve the daemon and the plugin worker without either importing the
 * other's message type. `type` is required only so the type is not all-optional,
 * which would accept `{}`.
 */
type WorkspaceScopedMessage = { type: string; workspaceRoot?: string };

/**
 * Puts a workspace root into a form two independently-resolved spellings of the
 * same directory agree on.
 *
 * The sender's root and the receiver's root do not always come out of the same
 * branch of `workspaceRootInner`: one side can be handed `NX_WORKSPACE_ROOT_PATH`
 * verbatim while the other walks up from `process.cwd()`. On Windows those two
 * sources routinely disagree on the case of the drive letter — an editor or
 * agent may export `d:\repo` while `process.cwd()` reports `D:\repo` — and on
 * separators. Both address the same directory: Windows paths are
 * case-insensitive, and a drive letter is case-insensitive without exception.
 *
 * POSIX roots keep their case, where `/repo` and `/REPO` really can be two
 * directories.
 */
function normalizeWorkspaceRoot(workspaceRoot: string): string {
  return process.platform === 'win32'
    ? win32.normalize(workspaceRoot).toLowerCase()
    : posix.normalize(workspaceRoot);
}

/**
 * A message from a different workspace — two sharing an NX_SOCKET_DIR — must not
 * be processed. Roots are normalized first so that a workspace does not look
 * foreign to itself; see {@link normalizeWorkspaceRoot}.
 */
export function isForeignWorkspaceMessage(
  msg: WorkspaceScopedMessage,
  receiverWorkspaceRoot: string
): boolean {
  if (msg.workspaceRoot === undefined) {
    return false;
  }
  return (
    normalizeWorkspaceRoot(msg.workspaceRoot) !==
    normalizeWorkspaceRoot(receiverWorkspaceRoot)
  );
}

/**
 * Throws on a message this receiver must not act on. The daemon catches it and
 * responds with the mismatch; the plugin worker catches it and drops the
 * message. `receiverDescription` names whichever raised it.
 *
 * An unstamped message is deliberately accepted: this is accident detection,
 * not a control.
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
