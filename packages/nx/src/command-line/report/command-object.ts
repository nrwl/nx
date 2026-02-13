import { CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';

export const yargsReportCommand: CommandModule = {
  command: 'report',
  describe:
    'Reports useful version numbers to copy into the Nx issue template.',
  handler: async () => {
    await (await handleImport('./report.js')).reportHandler();
    process.exit(0);
  },
};
