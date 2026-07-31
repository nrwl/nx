import { isAiAgent } from '../native';
import { getNxSocketRoot } from './tmp-dir';

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
  const socketRoot = getNxSocketRoot();
  return [
    certain
      ? `Your sandbox is blocking unix socket access. Nx creates its sockets under ${socketRoot}.`
      : `A sandbox blocking unix socket access is a common cause. Nx creates its sockets under ${socketRoot}.`,
    'To fix this, do one of the following:',
    ...(isAiAgent()
      ? [
          '  - Run `nx configure-ai-agents` to write the sandbox allowances Nx needs (Claude Code today). Agent sandboxes usually block writes to their own settings file, so this may have to be run from a regular terminal rather than through the agent.',
        ]
      : []),
    // A scoped allowlist is not enough on its own: Claude Code's
    // `allowUnixSockets` permits connecting to a socket but not creating one,
    // and every caller of this hint is creating a socket or making the first
    // connection to one that does not exist yet.
    `  - Allow your sandbox to create unix sockets under ${socketRoot}, not only connect to them, and grant read/write access to its parent directory. Claude Code needs \`allowAllUnixSockets: true\`; a scoped \`allowUnixSockets\` entry only covers connecting to a socket that already exists.`,
    '  - Set NX_SOCKET_DIR to a directory your sandbox allows.',
    // The one remedy that needs no sandbox change at all. Worth naming
    // explicitly: a denied bind is fatal to plugin isolation, so without this
    // an agent that cannot edit its own sandbox config has no way forward.
    '  - Keep going without sockets: NX_ISOLATE_PLUGINS=false runs plugins in the main process, and NX_DAEMON=false skips the daemon. Both cost performance but need no sandbox changes.',
    'See https://nx.dev/docs/kb/nx-sandbox-unix-sockets for details.',
  ];
}
