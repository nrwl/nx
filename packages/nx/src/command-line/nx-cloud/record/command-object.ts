import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsRecordCommand: CommandModule = {
  command: 'record [options]',
  describe:
    'Records a command execution for distributed task execution. This command is an alias for [`nx-cloud record`](/ci/reference/nx-cloud-cli#npx-nxcloud-record).',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help', type: 'boolean' }),
  handler: async (args: any) => {
    process.exit(await (await import('./record')).recordHandler(args));
  },
};
