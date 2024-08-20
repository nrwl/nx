import { Argv, CommandModule } from 'yargs';

export const yargsLoginCommand: CommandModule = {
  command: 'login',
  describe: false,
  builder: (yargs) =>
    yargs.positional('nxCloudUrl', {
      describe: 'The Nx Cloud URL of the instance you are trying to connect to.',
      type: 'string',
      required: false,
    }),
  handler: async (args: any) => {
    process.exit(await (await import('./login')).loginHandler(args));
  },
};
