import { CommandModule } from 'yargs';
import { exitAndFlushAnalytics } from '../../analytics/analytics';

export const yargsReportCommand: CommandModule = {
  command: 'report',
  describe:
    'Reports useful version numbers to copy into the Nx issue template.',
  handler: async () => {
    await (await import('./report')).reportHandler();
    exitAndFlushAnalytics(0);
  },
};
