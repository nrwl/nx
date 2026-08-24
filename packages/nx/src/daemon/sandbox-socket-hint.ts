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
 * Read from `utils/nx-tmp-dir`, which is Node-builtins-only, rather than from
 * `daemon/tmp-dir`, which reaches the native binding through cache-directory.
 * Plugin workers print this hint.
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
   * Pass `true` only when the errno proves the operating system refused the
   * socket (`EPERM`/`EACCES` on a bind or connect). `isSandbox()` alone does
   * not qualify: it proves a sandbox exists, not that the sandbox is what
   * broke this operation, and most callers reach the hint on failures a
   * sandbox is only one possible cause of.
   */
  certain?: boolean;
}

/**
 * Guidance for socket access that a sandbox may be blocking. The lead line is
 * definitive only when the caller has an errno proving the refusal; otherwise
 * it names a sandbox as a likely cause and leaves room for the other reasons
 * the operation could have failed. AI agents additionally get the
 * `configure-ai-agents` remediation, which only applies to them.
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
      ? `Your sandbox is blocking unix socket access. Nx creates its sockets under ${roots}.`
      : `A sandbox blocking unix socket access is a common cause. Nx creates its sockets under ${roots}.`,
    'To fix this, do one of the following:',
    ...(isAiAgent()
      ? [
          '  - Run `nx configure-ai-agents` to write the sandbox allowances Nx needs (Claude Code today). Agent sandboxes usually block writes to their own settings file, so this may have to be run from a regular terminal rather than through the agent.',
        ]
      : []),
    ...sandboxSpecificRemedy(roots),
    '  - Set NX_SOCKET_DIR to a directory your sandbox allows.',
    // The one remedy that needs no sandbox change at all. Worth naming
    // explicitly: a denied bind is fatal to plugin isolation, so without this
    // an agent that cannot edit its own sandbox config has no way forward.
    '  - Keep going without sockets: NX_ISOLATE_PLUGINS=false runs plugins in the main process, and NX_DAEMON=false skips the daemon. Both cost performance but need no sandbox changes.',
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
 *   broad one, so it is offered rather than recommended, next to the remedies
 *   below that need no sandbox change at all.
 * - Copilot CLI gates on the path like Claude, but reads its sandbox policy
 *   only from the user-level settings file, so this is the one agent
 *   `configure-ai-agents` cannot configure by writing into the workspace.
 */
function sandboxSpecificRemedy(roots: string): string[] {
  switch (detectAiAgent()) {
    case 'claude':
      return [
        `  - Add ${roots} to \`sandbox.network.allowUnixSockets\` and to \`sandbox.filesystem.allowRead\`/\`allowWrite\` in your Claude Code settings. The scoped entry covers creating sockets, not only connecting to them.`,
      ];
    case 'copilot-cli':
      return [
        `  - Add ${roots} to \`sandbox.userPolicy.filesystem.readwritePaths\` in \`~/.copilot/settings.json\`. Copilot CLI reads sandbox policy only from that user-level file, so a copy committed to the workspace has no effect.`,
      ];
    case 'codex':
      return [
        `  - Codex only permits unix sockets when \`sandbox_workspace_write.network_access\` is true, and has no setting that scopes them to a path. Enabling it also grants network access, so prefer one of the options below unless you want that. If you do enable it, add ${roots} to \`sandbox_workspace_write.writable_roots\` as well.`,
      ];
    default:
      return [
        `  - Allow your sandbox to create unix sockets under ${roots}, not only connect to them, and grant read and write on those directories.`,
      ];
  }
}
