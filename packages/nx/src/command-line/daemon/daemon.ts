import type { Arguments } from 'yargs';
import { DAEMON_OUTPUT_LOG_FILE, isDaemonDisabled } from '../../daemon/tmp-dir';
import { output } from '../../utils/output';
import { generateDaemonHelpOutput } from '../../daemon/client/generate-help-output';
import { IS_WASM } from 'nx/src/native';
import { isCI } from 'nx/src/utils/is-ci';
import { readNxJson } from 'nx/src/config/nx-json';
import { readDaemonProcessJsonCache } from 'nx/src/daemon/cache';

export async function daemonHandler(args: Arguments) {
  if (args.start) {
    const nxJson = readNxJson();

    const { daemonClient } = await import('../../daemon/client/client');

    if (!daemonClient.enabled()) {
      if (isDaemonDisabled()) {
        output.log({
          title: 'Daemon Server - Disabled',
          bodyLines: [
            'The daemon was disabled automatically because it experienced an error. To re-enable it and clear its cache, run `nx reset --workspace-data-only` before your next command.',
          ],
        });
        return;
      } else if (IS_WASM || isCI()) {
        output.log({
          title: 'Daemon Server - Disabled',
          bodyLines: [
            'The daemon is disabled because it is not supported on this platform.',
          ],
        });
      } else if (nxJson.useDaemonProcess === false) {
        output.log({
          title: 'Daemon Server - Disabled',
          bodyLines: [
            'The daemon is disabled because it is disabled in your nx.json.',
          ],
        });
      } else if (process.env.NX_DAEMON === 'false') {
        output.log({
          title: 'Daemon Server - Disabled',
          bodyLines: [
            'The daemon is disabled because it is disabled by the NX_DAEMON environment variable.',
          ],
        });
      }
      return;
    }

    if (daemonClient.isServerAvailable()) {
      const pid = readDaemonProcessJsonCache().processId;
      output.log({
        title: 'Daemon Server - Already running',
        bodyLines: [
          `The daemon server is already running (PID: ${pid}). To stop it, run \`nx daemon --stop\`.`,
        ],
      });
      return;
    }

    const pid = await daemonClient.startInBackground();
    output.log({
      title: `Daemon Server - Started in a background process...`,
      bodyLines: [
        `${output.dim('Logs from the Daemon process (')}ID: ${pid}${output.dim(
          ') can be found here:'
        )} ${DAEMON_OUTPUT_LOG_FILE}\n`,
      ],
    });
  } else if (args.stop) {
    const { daemonClient } = await import('../../daemon/client/client');
    await daemonClient.stop();
    output.log({ title: 'Daemon Server - Stopped' });
  } else {
    console.log(generateDaemonHelpOutput());
  }
}
