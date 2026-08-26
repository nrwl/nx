import { detectAiAgent, isAiAgent } from '../native';
import { NX_HOME_TMP_DIR, NX_TMP_DIR } from '../utils/nx-tmp-dir';

/**
 * The containers a sandbox has to allow, best first — not the directory finally
 * used. Socket resolution walks a chain and the winning tier depends on what it
 * could establish, so naming one root would be wrong wherever the other was
 * picked. These are also the paths an allowlist entry covers: everything Nx
 * binds lives beneath them.
 *
 * The home root is shown as the literal `~/.nx` rather than expanded, because a
 * committed allowlist entry has to expand per user to be worth sharing.
 *
 * A configured NX_SOCKET_DIR overrides the chain entirely, so it is named on its
 * own — pointing someone at the default roots when their sockets are somewhere
 * else is worse than saying nothing. `||` rather than `??` matches how
 * `tmp-dir` reads it: an empty value means unset.
 *
 * Read from `utils/nx-tmp-dir` rather than from `daemon/tmp-dir`, whose module
 * scope establishes directories and resolves a socket tier on import. Plugin
 * workers print this hint, and must not pay that to do it.
 */
function socketRoots(): string {
  const configured =
    process.env.NX_SOCKET_DIR || process.env.NX_DAEMON_SOCKET_DIR;
  if (configured) {
    return configured;
  }
  return [NX_TMP_DIR, NX_HOME_TMP_DIR ? '~/.nx' : undefined]
    .filter(Boolean)
    .join(' or ');
}

export interface SandboxSocketHintOptions {
  /**
   * Pass `true` only when an errno proves the operating system refused the
   * socket (`EPERM`/`EACCES` on a bind or connect). Most callers reach this
   * hint holding a failure that denied permission only explains — a worker
   * that died before it reported anything, an internal daemon error — and for
   * those the lead line offers the cause rather than asserting it.
   */
  certain?: boolean;
}

/**
 * Guidance for a unix socket Nx was not allowed to use. The lead line names
 * denied permission, which is the part Nx can observe; a sandbox is the most
 * common source but not the only one, so which remedy applies is left to the
 * list rather than decided in the first sentence. AI agents additionally get
 * the `configure-ai-agents` remediation, which only applies to them.
 *
 * Lives in its own module (rather than the daemon client) so that plugin
 * workers and the plugin host can use it without pulling in the daemon
 * client's module-level `DaemonClient` singleton.
 */
export function sandboxSocketHint({
  certain = false,
}: SandboxSocketHintOptions = {}): string[] {
  const roots = socketRoots();
  return [
    certain
      ? `Nx was denied permission to use its unix socket under ${roots}.`
      : `Nx could not use its unix socket under ${roots}. Denied permission on that directory is a common cause.`,
    'To fix this, do one of the following:',
    ...(isAiAgent()
      ? [
          '  - Run `nx configure-ai-agents` to write the sandbox allowances Nx needs. Agent sandboxes usually block writes to their own settings file, so this may have to be run from a regular terminal rather than through the agent.',
        ]
      : []),
    ...sandboxSpecificRemedy(roots),
    `  - Get permission to create sockets under ${roots}, or set NX_SOCKET_DIR to a directory you do have permission for.`,
    'See https://nx.dev/docs/kb/nx-sandbox-unix-sockets for details.',
  ];
}

/**
 * The per-agent form of "allow sockets under these roots". Each sandbox gates
 * socket creation on something different, so a single generic sentence sends
 * at least one of them to a setting that does not exist:
 *
 * - Claude Code gates on the path allowlist. A scoped `allowUnixSockets` entry
 *   covers binding as well as connecting, so it is sufficient and preferable to
 *   `allowAllUnixSockets`, which opens every socket on the machine.
 * - Codex gates on `network_access` instead, and has no path-scoped socket
 *   setting. `writable_roots` alone does not unblock a bind. That grant is a
 *   broad one, so the line says what it costs rather than presenting it as
 *   equivalent to the scoped entries.
 * - Copilot CLI gates on the path like Claude, but reads its sandbox policy
 *   only from the user-level settings file, so this is the one agent
 *   `configure-ai-agents` cannot configure by writing into the workspace.
 */
function sandboxSpecificRemedy(roots: string): string[] {
  switch (detectAiAgent()) {
    case 'claude':
      return [
        `  - Add ${roots} to \`sandbox.network.allowUnixSockets\` and to \`sandbox.filesystem.allowRead\`/\`allowWrite\` in \`.claude/settings.json\`. The scoped entry covers creating sockets, not only connecting to them.`,
      ];
    case 'copilot-cli':
      return [
        `  - Add ${roots} to \`sandbox.userPolicy.filesystem.readwritePaths\` in \`~/.copilot/settings.json\`. Copilot CLI reads sandbox policy only from that user-level file, so a copy committed to the workspace has no effect.`,
      ];
    case 'codex':
      return [
        `  - In \`~/.codex/config.toml\`, set \`sandbox_workspace_write.network_access\` to true and add ${roots} to \`sandbox_workspace_write.writable_roots\`. Codex has no setting that scopes sockets to a path, and \`network_access\` also grants general network access, so this is a broader grant than the other agents need.`,
      ];
    default:
      return [
        `  - Allow your sandbox to create unix sockets under ${roots}, not only connect to them, and grant read and write on those directories.`,
      ];
  }
}
