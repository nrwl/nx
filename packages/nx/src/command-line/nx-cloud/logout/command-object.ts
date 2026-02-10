import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';
import { exitAndFlushAnalytics } from '../../../analytics/analytics';

export const yargsLogoutCommand: CommandModule = {
  command: 'logout',
  describe:
    'Logout from Nx Cloud. This command is an alias for `nx-cloud logout`.',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    exitAndFlushAnalytics(await (await import('./logout')).logoutHandler(args));
  },
};
