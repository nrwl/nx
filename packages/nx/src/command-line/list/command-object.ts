import { CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';

export const yargsListCommand: CommandModule = {
  command: 'list [plugin]',
  describe:
    'Lists installed plugins, capabilities of installed plugins and other available plugins.',
  builder: (yargs) =>
    yargs
      .positional('plugin', {
        type: 'string',
        description: 'The name of an installed plugin to query.',
      })
      .option('json', {
        type: 'boolean',
        description: 'Output JSON.',
      }),
  handler: async (args: any) => {
    await (await handleImport('./list.js')).listHandler(args);
    process.exit(0);
  },
};
