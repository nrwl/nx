import { CommandModule } from 'yargs';

export const yargsMcpCommand: CommandModule = {
  command: 'mcp',
  describe: 'Starts the Nx MCP server.',
  builder: (y) =>
    y
      .version(false)
      .strict(false)
      .parserConfiguration({
        'unknown-options-as-args': true,
        'populate--': true,
      })
      .usage('')
      .help(false)
      .showHelp(async () => {
        await (await import('./mcp')).showHelp();
        process.exit(0);
      }),
  handler: async (args: any) => {
    await (await import('./mcp')).mcpHandler(args);
    process.exit(0);
  },
};
