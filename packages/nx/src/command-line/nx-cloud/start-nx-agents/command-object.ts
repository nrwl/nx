import { CommandModule } from 'yargs';
import { handleImport } from '../../../utils/handle-import';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsStartNxAgentsCommand: CommandModule = {
  command: 'start-nx-agents [options]',
  describe:
    'Provisions Nx Agents for distributed task execution, reading configuration from `.nx/ci-config.yaml`. This command is an alias for [`nx-cloud start-nx-agents`](/docs/reference/nx-cloud-cli#nx-cloud-start-nx-agents).',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    process.exit(
      await (
        await handleImport('./start-nx-agents.js', __dirname)
      ).startNxAgentsHandler(args)
    );
  },
};
