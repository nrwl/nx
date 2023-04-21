import { CommandModule } from 'yargs';

export const yargsReportCommand: CommandModule = {
  command: 'report',
  describe: 'Reports useful version numbers to copy into the Nx issue template',
  handler: async () => {
    await (await import('./report')).reportHandler();
    process.exit(0);
  },
};
