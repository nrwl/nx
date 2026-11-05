import { CommandModule } from 'yargs';
import { handleImport } from '../../../utils/handle-import';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsLogoutCommand: CommandModule = {
  command: 'logout [nxCloudUrl]',
  describe:
    'Logout from Nx Cloud. This command is an alias for `nx-cloud logout`.',
  builder: (yargs) =>
    withVerbose(
      yargs
        .positional('nxCloudUrl', {
          describe:
            'The URL of the Nx Cloud instance to log out of. With several stored logins, pass one URL or --all.',
          type: 'string',
          required: false,
        })
        .option('all', {
          describe:
            'Log out of every Nx Cloud instance stored on this machine.',
          type: 'boolean',
        })
    )
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    process.exit(
      await (await handleImport('./logout.js', __dirname)).logoutHandler(args)
    );
  },
};
