import type { AddressInfo } from 'net';
import { dirname } from 'path';

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
  update(event: ReporterEvent): void {
    super.update(event);
    if (
      event.type !== 'server_listening' ||
      !process.env.NX_READY_SIGNAL_SOCKET
    ) {
      return;
    }
    const { signalTaskReady } =
      require('@nx/devkit') as typeof import('@nx/devkit');
    const { getListeningUrl } =
      require('@nx/devkit/internal') as typeof import('@nx/devkit/internal');
    signalTaskReady({
      url: getListeningUrl(
        event as ServerListeningEvent,
        // The event has no protocol; react-native start also takes it from --https
        process.argv.includes('--https')
      ),
    });
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
