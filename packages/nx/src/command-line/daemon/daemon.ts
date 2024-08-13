import type { Arguments } from 'yargs';
import { DAEMON_OUTPUT_LOG_FILE } from '../../daemon/tmp-dir';
import { output } from '../../utils/output';
import { generateDaemonHelpOutput } from '../../daemon/client/generate-help-output';
import { streamLogs } from '../../daemon/client/stream-logs';

export async function daemonHandler(args: Arguments) {
  if (args.start) {
    const { daemonClient } = await import('../../daemon/client/client');
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
  } else if (args.stream) {
    streamLogs(true);
  } else {
    console.log(generateDaemonHelpOutput());
  }
}
