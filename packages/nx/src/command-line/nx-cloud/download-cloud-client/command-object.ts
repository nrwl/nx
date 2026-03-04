import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsDownloadCloudClientCommand: CommandModule = {
  command: 'download-cloud-client',
  describe: 'Download the Nx Cloud client.',
  builder: (yargs) => withVerbose(yargs),
  handler: async (args: any) => {
    process.exit(
      await (
        await import('./download-cloud-client')
      ).downloadCloudClientHandler(args)
    );
  },
};
