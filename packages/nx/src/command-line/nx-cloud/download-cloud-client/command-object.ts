import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';
import { exitAndFlushAnalytics } from '../../../analytics/analytics';

export const yargsDownloadCloudClientCommand: CommandModule = {
  command: 'download-cloud-client',
  describe: 'Download the Nx Cloud client.',
  builder: (yargs) => withVerbose(yargs),
  handler: async (args: any) => {
    exitAndFlushAnalytics(
      await (
        await import('./download-cloud-client')
      ).downloadCloudClientHandler(args)
    );
  },
};
