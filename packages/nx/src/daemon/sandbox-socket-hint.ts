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
          '  - Run `nx configure-ai-agents` to write the required sandbox allowances for supported agents.',
        ]
      : []),
    `  - Configure your sandbox to allow unix socket connections to ${socketRoot} and read/write access to its parent directory.`,
    // A scoped allowlist is not enough for every sandbox: Claude Code's
    // `allowUnixSockets` permits connecting to a socket but not creating one,
    // and every caller of this hint is creating a socket or making the first
    // connection to one that does not exist yet.
    '  - Allow creating unix sockets, not only connecting to them. Claude Code needs `allowAllUnixSockets: true` for Nx to start a daemon or a plugin worker from inside the sandbox.',
    '  - Set NX_SOCKET_DIR to a directory your sandbox allows.',
    'See https://nx.dev/docs/kb/nx-sandbox-unix-sockets for details.',
  ];
}
