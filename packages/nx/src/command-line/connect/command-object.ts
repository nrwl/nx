import { CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';

export const yargsConnectCommand: CommandModule = {
  command: 'connect',
  aliases: ['connect-to-nx-cloud'],
  describe: `Connect workspace to Nx Cloud`,
  builder: (yargs) => linkToNxDevAndExamples(yargs, 'connect-to-nx-cloud'),
  handler: async () => {
    await (await import('./connect-to-nx-cloud')).connectToNxCloudCommand();
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
