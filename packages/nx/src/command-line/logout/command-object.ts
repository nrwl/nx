import { CommandModule } from 'yargs';

export const yargsLogoutCommand: CommandModule = {
  command: 'logout',
  describe:
    'Logout from Nx Cloud by removing a personal access token from your local machine. The personal access token will be revoked from Nx Cloud and you will need to login again to regain access to Nx Cloud.',
  builder: (yargs) =>
    yargs.option('verbose', {
      type: 'boolean',
      description:
        'Prints additional information about the commands (e.g., stack traces)',
    }),
  handler: async (args: any) => {
    process.exit(await (await import('./logout')).logoutHandler(args));
  },
};
