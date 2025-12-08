import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsStartAgentCommand: CommandModule = {
  command: 'start-agent [options]',
  describe:
    'Starts a new agent for distributed task execution. This command is an alias for [`nx-cloud start-agent`](/docs/reference/nx-cloud-cli).',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    process.exit(
      await (await import('./start-agent.js')).startAgentHandler(args)
    );
  },
};
