import type { Arguments } from 'yargs';
import { getDaemonProcessIdSync } from '../../daemon/cache';
import { DAEMON_OUTPUT_LOG_FILE } from '../../daemon/tmp-dir';
import { handleImport } from '../../utils/handle-import';
import { output } from '../../utils/output';

export async function daemonHandler(args: Arguments) {
  const { daemonClient } = await handleImport(
    '../../daemon/client/client.js',
    __dirname
  );

  if (args.start) {
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
    await daemonClient.stop();
    output.log({ title: 'Daemon Server - Stopped' });
  } else if (await daemonClient.isServerAvailable()) {
    const pid = getDaemonProcessIdSync();
    console.log(
      `Nx Daemon is currently running:
  - Logs: ${DAEMON_OUTPUT_LOG_FILE}${pid ? `\n  - Process ID: ${pid}` : ''}`
    );
  } else {
    console.log('Nx Daemon is not running.');
  }
}
