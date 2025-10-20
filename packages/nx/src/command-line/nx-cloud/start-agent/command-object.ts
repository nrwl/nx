import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsStartAgentCommand: CommandModule = {
  command: 'start-agent [options]',
  describe:
    'Starts a new Nx Agent for distributed task execution. This command is an alias for [`nx-cloud start-agent`](/ci/reference/nx-cloud-cli).',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    process.exit(await (await import('./start-agent')).startAgentHandler(args));
  },
};
