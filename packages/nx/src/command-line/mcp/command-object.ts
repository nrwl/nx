import { Argv, CommandModule } from 'yargs';
import { exitAndFlushAnalytics } from '../../analytics/analytics';

export const yargsMcpCommand: CommandModule = {
  command: 'mcp',
  describe: 'Starts the Nx MCP server.',
  // @ts-expect-error - yargs types are outdated, refer to docs - https://github.com/yargs/yargs/blob/main/docs/api.md#commandmodule
  builder: async (y: Argv, helpOrVersionSet: boolean) => {
    if (helpOrVersionSet) {
      (await Promise.resolve().then(() => require('./mcp'))).showHelp();
      exitAndFlushAnalytics(0);
    }
    return y
      .version(false)
      .strict(false)
      .parserConfiguration({
        'unknown-options-as-args': true,
        'populate--': true,
      })
      .usage('')
      .help(false)
      .showHelpOnFail(false);
  },
  handler: async (args: any) => {
    await (await import('./mcp')).mcpHandler(args);
    exitAndFlushAnalytics(0);
  },
};
