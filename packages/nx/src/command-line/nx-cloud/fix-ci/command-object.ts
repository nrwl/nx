import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';
import { exitAndFlushAnalytics } from '../../../analytics/analytics';

export const yargsFixCiCommand: CommandModule = {
  command: 'fix-ci [options]',
  describe:
    'Fixes CI failures. This command is an alias for [`nx-cloud fix-ci`](/ci/reference/nx-cloud-cli#npx-nxcloud-fix-ci).',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    exitAndFlushAnalytics(await (await import('./fix-ci')).fixCiHandler(args));
  },
};
