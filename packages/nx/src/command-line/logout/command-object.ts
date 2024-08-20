import { CommandModule } from 'yargs';
import { withVerbose } from '../../command-line/yargs-utils/shared-options';

export const yargsLogoutCommand: CommandModule = {
  command: 'logout',
  describe:
    'Logout from Nx Cloud by removing a personal access token from your local machine. The personal access token will be revoked from Nx Cloud and you will need to login again to regain access to Nx Cloud.',
  builder: (yargs) => withVerbose(yargs),
  handler: async (args: any) => {
    process.exit(await (await import('./logout')).logoutHandler(args));
  },
};
