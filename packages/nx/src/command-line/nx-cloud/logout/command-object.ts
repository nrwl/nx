import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsLogoutCommand: CommandModule = {
  command: 'logout',
  describe:
    'Logout from Nx Cloud. This command is an alias for [`nx-cloud logout`](/ci/reference/nx-cloud-cli#npx-nxcloud-logout).',
  builder: (yargs) =>
    withVerbose(yargs)
      .option('help', { describe: 'Show Help.', type: 'boolean' })
      .help(false)
      .showHelpOnFail(false),
  handler: async (args: any) => {
    process.exit(await (await import('./logout')).logoutHandler(args));
  },
};
