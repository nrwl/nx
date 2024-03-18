import { Argv, CommandModule } from 'yargs';

export const yargsNewCommand: CommandModule = {
  command: 'new [_..]',
  describe: false,
  builder: (yargs) => withNewOptions(yargs),
  handler: async (args) => {
    args._ = args._.slice(1);
    process.exit(
      await (
        await import('./new')
      ).newWorkspace(args['nxWorkspaceRoot'] as string, args)
    );
  },
};

function withNewOptions(yargs: Argv) {
  return yargs
    .option('nxWorkspaceRoot', {
      describe: 'The folder where the new workspace is going to be created',
      type: 'string',
      required: true,
    })
    .option('interactive', {
      describe: 'When false disables interactive input prompts for options',
      type: 'boolean',
      default: true,
    });
}
