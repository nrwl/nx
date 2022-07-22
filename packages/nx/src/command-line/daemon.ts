import type { Arguments } from 'yargs';
import { DAEMON_OUTPUT_LOG_FILE } from '../daemon/tmp-dir';
import { output } from '../utils/output';
import { generateDaemonHelpOutput } from '../daemon/client/generate-help-output';

export async function daemonHandler(args: Arguments) {
  if (args.start) {
    const { startInBackground, startInCurrentProcess } = await import(
      '../daemon/client/client'
    );
    if (!args.background) {
      return startInCurrentProcess();
    }
    const pid = await startInBackground();
    output.log({
      title: `Daemon Server - Started in a background process...`,
      bodyLines: [
        `${output.dim('Logs from the Daemon process (')}ID: ${pid}${output.dim(
          ') can be found here:'
        )} ${DAEMON_OUTPUT_LOG_FILE}\n`,
      ],
    });
  } else {
    console.log(generateDaemonHelpOutput());
  }
}
