import { detectAiAgent } from '../native';
import { isSandbox } from '../utils/is-sandbox';
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
 * list rather than decided in the first sentence.
 *
 * Every sandbox-shaped line — the `configure-ai-agents` remediation, the
 * per-agent setting, the knowledge base link — is dropped unless a sandbox is
 * actually running. A root-owned socket dir on a plain workstation reaches this
 * hint too, and there the permission line is the whole truth, so it is stated
 * outright rather than offered as the one item of a list.
 *
 * Lives in its own module (rather than the daemon client) so that plugin
 * workers and the plugin host can use it without pulling in the daemon
 * client's module-level `DaemonClient` singleton.
 */
export function sandboxSocketHint({
  certain = false,
}: SandboxSocketHintOptions = {}): string[] {
  const roots = socketRoots();
  const sandboxRemedy = sandboxSpecificRemedy(roots, certain);
  const lead = certain
    ? `Nx was denied permission to use its unix socket under ${roots}.`
    : `Nx could not use its unix socket under ${roots}. Denied permission on that directory is a common cause.`;
  const permissionRemedy = `Get permission to create sockets under ${roots}, or set NX_SOCKET_DIR to a directory you do have permission for.`;

  if (sandboxRemedy.length === 0) {
    return [lead, permissionRemedy];
  }

  return [
    lead,
    'To fix this, do one of the following:',
    // Only Claude Code: the generator's `sandbox` block sits inside
    // `hasAgent('claude')`, so offering this to a Codex or Copilot CLI user
    // sends them to a command that writes nothing they need.
    ...(detectAiAgent() === 'claude'
      ? [
          '  - Run `nx configure-ai-agents` to write the sandbox allowances Nx needs. Agent sandboxes usually block writes to their own settings file, so this may have to be run from a regular terminal rather than through the agent.',
        ]
      : []),
    ...sandboxRemedy.map((remedy) => `  - ${remedy}`),
    `  - ${permissionRemedy}`,
    'See https://nx.dev/docs/kb/nx-sandbox-unix-sockets for details.',
  ];
}

/**
 * The per-agent form of "allow sockets under these roots", or nothing at all
 * when nothing indicates a sandbox.
 *
 * A detected agent is not itself that indication: every Claude Code session sets
 * `CLAUDECODE`, but only a sandboxed one sets `SANDBOX_RUNTIME` (measured on
 * 2.1.248 with `sandbox.enabled` both ways). What counts is `isSandbox()`, or —
 * for a *known* agent — an errno proving the socket was refused. Copilot CLI
 * needs that second arm: its sandbox sets no variable `isSandbox()` reads
 * (measured on 1.0.80, where a bind under both roots is refused while `$TMPDIR`
 * succeeds), so the errno is the only evidence Nx ever gets. An unknown
 * environment gets no such benefit, because there a refusal is just a refusal —
 * a root-owned socket dir left by `sudo nx` reads identically.
 *
 * The agent then decides *which* setting to name, because each sandbox gates
 * socket creation on something different and a single generic sentence sends at
 * least one of them to a setting that does not exist:
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
 *
 * Any other agent, or none, leaves the setting unknown, so the fallback can only
 * describe the grant.
 */
function sandboxSpecificRemedy(roots: string, certain: boolean): string[] {
  const sandboxed = isSandbox();
  const agent = detectAiAgent();
  const knownAgent =
    agent === 'claude' || agent === 'codex' || agent === 'copilot-cli';
  if (knownAgent && !sandboxed && !certain) {
    return [];
  }

  switch (agent) {
    case 'claude':
      return [
        `Add ${roots} to \`sandbox.network.allowUnixSockets\` and to \`sandbox.filesystem.allowRead\`/\`allowWrite\` in \`.claude/settings.json\`. The scoped entry covers creating sockets, not only connecting to them.`,
      ];
    case 'copilot-cli':
      return [
        `Add ${roots} to \`sandbox.userPolicy.filesystem.readwritePaths\` in \`~/.copilot/settings.json\`. Copilot CLI reads sandbox policy only from that user-level file, so a copy committed to the workspace has no effect.`,
      ];
    case 'codex':
      return [
        `In \`~/.codex/config.toml\`, set \`sandbox_workspace_write.network_access\` to true and add ${roots} to \`sandbox_workspace_write.writable_roots\`. Codex has no setting that scopes sockets to a path, and \`network_access\` also grants general network access, so this is a broader grant than the other agents need.`,
      ];
    default:
      return sandboxed
        ? [
            `Allow your sandbox to create unix sockets under ${roots}, not only connect to them, and grant read and write on those directories.`,
          ]
        : [];
  }
}
