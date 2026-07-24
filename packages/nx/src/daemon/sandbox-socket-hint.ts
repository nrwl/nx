import { isAiAgent } from '../native';
import { getNxSocketRoot } from './tmp-dir';

/**
 * Guidance for socket access being blocked by a sandbox. Callers either know
 * the sandbox is real (`isSandbox()`) or are looking at an errno that only a
 * blocked socket produces, so the wording states the cause rather than
 * hedging. AI agents additionally get the `configure-ai-agents` remediation,
 * which only applies to them.
 *
 * Lives in its own module (rather than the daemon client) so that plugin
 * workers and the plugin host can use it without pulling in the daemon
 * client's module-level `DaemonClient` singleton.
 */
export function sandboxSocketHint(): string[] {
  if (isAiAgent()) {
    return [
      `Your sandbox is blocking unix socket access. Nx creates its sockets under ${getNxSocketRoot()}.`,
      'To fix this, do one of the following:',
      '  - Run `nx configure-ai-agents` to write the required sandbox allowances for supported agents.',
      `  - Configure your sandbox to allow unix socket connections to ${getNxSocketRoot()} and read/write access to its parent directory.`,
      '  - Set NX_SOCKET_DIR to a directory your sandbox allows.',
      'See https://nx.dev/docs/troubleshooting/nx-sandbox-unix-sockets for details.',
    ];
  }
  return [
    `Your sandbox is blocking unix socket access. Nx creates its sockets under ${getNxSocketRoot()}.`,
    `Allow unix socket connections to ${getNxSocketRoot()} and read/write access to its parent directory, or set NX_SOCKET_DIR to a directory your sandbox allows.`,
    'See https://nx.dev/docs/troubleshooting/nx-sandbox-unix-sockets for details.',
  ];
}
