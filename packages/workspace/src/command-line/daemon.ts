import type { Arguments } from 'yargs';
import { DAEMON_OUTPUT_LOG_FILE } from '../core/project-graph/daemon/tmp-dir';
import { output } from '../utilities/output';

export async function daemonHandler(args: Arguments) {
  const { startInBackground, startInCurrentProcess } = await import(
    '../core/project-graph/daemon/client/client'
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
}
