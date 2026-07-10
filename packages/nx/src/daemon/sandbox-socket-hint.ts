import { isAiAgent } from '../native';
import { getNxSocketRoot } from './tmp-dir';

/**
 * Guidance for socket access being blocked by a sandbox. When an AI agent is
 * driving nx the message is written for the agent to act on directly; for
 * humans it is a brief pointer since sandboxing is a less likely cause.
 *
 * Lives in its own module (rather than the daemon client) so that plugin
 * workers and the plugin host can use it without pulling in the daemon
 * client's module-level `DaemonClient` singleton.
 */
export function sandboxSocketHint(): string[] {
  if (isAiAgent()) {
    return [
      `Your sandbox is likely blocking unix socket access. Nx creates its sockets under ${getNxSocketRoot()}.`,
      'To fix this, do one of the following:',
      '  - Run `nx configure-ai-agents` to write the required sandbox allowances for supported agents.',
      `  - Configure your sandbox to allow unix socket connections to ${getNxSocketRoot()} and read/write access to its parent directory.`,
      '  - Set NX_SOCKET_DIR to a directory your sandbox allows.',
      'See https://nx.dev/docs/troubleshooting/nx-sandbox-unix-sockets for details.',
    ];
  }
  return [
    `If Nx is running inside a sandboxed environment, allow unix socket access to ${getNxSocketRoot()} or set NX_SOCKET_DIR to an accessible directory.`,
    'See https://nx.dev/docs/troubleshooting/nx-sandbox-unix-sockets for details.',
  ];
}
