import { CommandModule, Argv } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { handleErrors } from '../../utils/handle-errors';
import { handleImport } from '../../utils/handle-import';
import { withVerbose } from '../yargs-utils/shared-options';
import { makeCommandModule } from '../yargs-utils/arguments-of';

const builder = (yargs: Argv) =>
  linkToNxDevAndExamples(withVerbose(withDaemonOptions(yargs)), 'daemon');

export const yargsDaemonCommand = makeCommandModule({
  command: 'daemon',
  describe:
    'Prints information about the Nx Daemon process or starts a daemon process.',
  builder,
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose, async () =>
      (await handleImport('./daemon.js')).daemonHandler(args)
    );
    process.exit(exitCode);
  },
});

function withDaemonOptions(yargs: Argv): Argv {
  return yargs
    .option('start', {
      type: 'boolean',
      default: false,
    })
    .option('stop', {
      type: 'boolean',
      default: false,
    });
}
