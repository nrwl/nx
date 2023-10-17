import { CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import type { ConnectToNxCloudOptions } from './connect-to-nx-cloud';

export const yargsConnectCommand: CommandModule<{}, ConnectToNxCloudOptions> = {
  command: 'connect',
  aliases: ['connect-to-nx-cloud'],
  describe: `Connect workspace to Nx Cloud`,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      yargs.option('interactive', {
        type: 'boolean',
        description: 'Prompt for confirmation',
        default: true,
      }),
      'connect-to-nx-cloud'
    ),
  handler: async (options) => {
    await (
      await import('./connect-to-nx-cloud')
    ).connectToNxCloudCommand(options);
    process.exit(0);
  },
};

export const yargsViewLogsCommand: CommandModule = {
  command: 'view-logs',
  describe:
    'Enables you to view and interact with the logs via the advanced analytic UI from Nx Cloud to help you debug your issue. To do this, Nx needs to connect your workspace to Nx Cloud and upload the most recent run details. Only the metrics are uploaded, not the artefacts.',
  handler: async () =>
    process.exit(await (await import('./view-logs')).viewLogs()),
};
