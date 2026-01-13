import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsStopAllAgentsCommand: CommandModule = {
  command: 'stop-all-agents [options]',
  aliases: ['complete-ci-run'],
  describe:
    'Terminates all dedicated agents associated with this CI pipeline execution. This command is an alias for [`nx-cloud stop-all-agents`](/docs/reference/nx-cloud-cli#nx-cloud-stop-all-agents).',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    process.exit(
      await (await import('./stop-all-agents.js')).stopAllAgentsHandler(args),
    );
  },
};
