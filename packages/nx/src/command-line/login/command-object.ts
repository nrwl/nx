import { CommandModule } from 'yargs';
import { withVerbose } from '../../command-line/yargs-utils/shared-options';

export const yargsLoginCommand: CommandModule = {
  command: 'login [nxCloudUrl]',
  describe:
    'Login to Nx Cloud by generating a personal access token and saving it to your local machine.',
  builder: (yargs) =>
    withVerbose(
      yargs.positional('nxCloudUrl', {
        describe:
          'The Nx Cloud URL of the instance you are trying to connect to. If no positional argument is provided, this command will connect to https://cloud.nx.app.',
        type: 'string',
        required: false,
      })
    ),
  handler: async (args: any) => {
    process.exit(await (await import('./login')).loginHandler(args));
  },
};
