import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';
import { exitAndFlushAnalytics } from '../../../analytics/analytics';

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
    exitAndFlushAnalytics(await (await import('./start-agent')).startAgentHandler(args));
  },
};
