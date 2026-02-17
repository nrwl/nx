import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';
import { exitAndFlushAnalytics } from '../../../analytics/analytics';

export const yargsStartCiRunCommand: CommandModule = {
  command: 'start-ci-run [options]',
  describe:
    'Starts a new CI run for distributed task execution. This command is an alias for [`nx-cloud start-ci-run`](/docs/reference/nx-cloud-cli#npx-nxcloud-start-ci-run).',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    exitAndFlushAnalytics(
      await (await import('./start-ci-run')).startCiRunHandler(args)
    );
  },
};
