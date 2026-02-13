import { CommandModule } from 'yargs';
import { handleImport } from '../../../utils/handle-import';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsDownloadCloudClientCommand: CommandModule = {
  command: 'download-cloud-client',
  describe: 'Download the Nx Cloud client.',
  builder: (yargs) => withVerbose(yargs),
  handler: async (args: any) => {
    process.exit(
      await (
        await handleImport('./download-cloud-client.js')
      ).downloadCloudClientHandler(args)
    );
  },
};
