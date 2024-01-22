import { CommandModule } from 'yargs';

export const yargsListCommand: CommandModule = {
  command: 'list [plugin]',
  describe:
    'Lists installed plugins, capabilities of installed plugins and other available plugins.',
  builder: (yargs) =>
    yargs.positional('plugin', {
      type: 'string',
      description: 'The name of an installed plugin to query',
    }),
  handler: async (args: any) => {
    await (await import('./list')).listHandler(args);
    process.exit(0);
  },
};
