import { subscribe } from 'diagnostics_channel';
import type { AddressInfo, Server } from 'net';
import { dirname } from 'path';
import { Server as TlsServer } from 'tls';

interface ReporterEvent {
  type: string;
}

interface ServerListeningEvent extends ReporterEvent, AddressInfo {
  type: 'server_listening';
}

const { TerminalReporter } = require(resolveMetro(process.cwd())) as {
  TerminalReporter: new (terminal: unknown) => {
    update(event: ReporterEvent): void;
  };
};

/**
 * Metro's terminal reporter, which also reports the dev server's address to an
 * Nx task whose readyWhen is `signal`. `react-native start` loads it through
 * `--custom-log-reporter-path`.
 */
class NxMetroReporter extends TerminalReporter {
  private secureByPort = new Map<number, boolean>();

  constructor(terminal: unknown) {
    super(terminal);
    if (process.env.NX_READY_SIGNAL_SOCKET) {
      // server_listening has no protocol, and Metro also serves HTTPS for a
      // `server.tls` config. This channel publishes before that event fires.
      subscribe('tracing:net.server.listen:asyncEnd', (message) => {
        const { server } = message as { server: Server };
        const address = server.address();
        if (address && typeof address === 'object') {
          this.secureByPort.set(address.port, server instanceof TlsServer);
        }
      });
    }
  }

  update(event: ReporterEvent): void {
    super.update(event);
    if (
      event.type !== 'server_listening' ||
      !process.env.NX_READY_SIGNAL_SOCKET
    ) {
      return;
    }
    const { emitReadySignal } =
      require('@nx/devkit') as typeof import('@nx/devkit');
    const { getListeningUrl } =
      require('@nx/devkit/internal') as typeof import('@nx/devkit/internal');
    const listening = event as ServerListeningEvent;
    emitReadySignal(
      getListeningUrl(
        listening,
        this.secureByPort.get(listening.port) ??
          process.argv.includes('--https')
      )
    );
  }
}

// The metro react-native start uses. This package does not depend on metro,
// so a plain require can fail or find another hoisted version.
function resolveMetro(projectRoot: string): string {
  const reactNative = dirname(
    require.resolve('react-native/package.json', { paths: [projectRoot] })
  );
  const cliPlugin = dirname(
    require.resolve('@react-native/community-cli-plugin/package.json', {
      paths: [reactNative],
    })
  );
  return require.resolve('metro', { paths: [cliPlugin] });
}

module.exports = NxMetroReporter;
