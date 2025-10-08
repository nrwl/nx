import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsLoginCommand: CommandModule = {
  command: 'login [nxCloudUrl]',
  describe: 'Login to Nx Cloud. This command is an alias for `nx-cloud login`.',
  builder: (yargs) =>
    withVerbose(
      yargs.positional('nxCloudUrl', {
        describe:
          'The Nx Cloud URL of the instance you are trying to connect to. If no positional argument is provided, this command will connect to your configured Nx Cloud instance by default.',
        type: 'string',
        required: false,
      })
    )
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    process.exit(await (await import('./login')).loginHandler(args));
  },
};
