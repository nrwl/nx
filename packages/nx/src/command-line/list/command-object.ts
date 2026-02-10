import { CommandModule } from 'yargs';
import { exitAndFlushAnalytics } from '../../analytics/analytics';

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
    await (await import('./list')).listHandler(args);
    exitAndFlushAnalytics(0);
  },
};
