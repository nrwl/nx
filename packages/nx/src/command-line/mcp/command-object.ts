import { Argv, CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';

export const yargsMcpCommand: CommandModule = {
  command: 'mcp',
  describe: 'Starts the Nx MCP server.',
  // @ts-expect-error - yargs types are outdated, refer to docs - https://github.com/yargs/yargs/blob/main/docs/api.md#commandmodule
  builder: async (y: Argv, helpOrVersionSet: boolean) => {
    if (helpOrVersionSet) {
      (await handleImport('./mcp', __dirname)).showHelp();
      process.exit(0);
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
    await (await handleImport('./mcp.js', __dirname)).mcpHandler(args);
    process.exit(0);
  },
};
