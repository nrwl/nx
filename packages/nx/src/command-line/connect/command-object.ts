import { Argv, CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { nxVersion } from '../../utils/versions';
import { withVerbose } from '../yargs-utils/shared-options';

export const yargsConnectCommand: CommandModule = {
  command: 'connect',
  aliases: ['connect-to-nx-cloud'],
  describe: `Connect workspace to Nx Cloud.`,
  builder: (yargs) =>
    linkToNxDevAndExamples(withConnectOptions(yargs), 'connect-to-nx-cloud'),
  handler: async (args: any) => {
    await (await import('./connect-to-nx-cloud')).connectToNxCloudCommand(args);
    await (
      await import('../../utils/ab-testing')
    ).recordStat({
      command: 'connect',
      nxVersion,
      useCloud: true,
    });
    process.exit(0);
  },
};

function withConnectOptions(yargs: Argv) {
  return withVerbose(yargs).option('generateToken', {
    type: 'boolean',
    description:
      'Explicitly asks for a token to be created, do not override existing tokens from Nx Cloud.',
  });
}

export const yargsViewLogsCommand: CommandModule = {
  command: 'view-logs',
  describe:
    'Enables you to view and interact with the logs via the advanced analytic UI from Nx Cloud to help you debug your issue. To do this, Nx needs to connect your workspace to Nx Cloud and upload the most recent run details. Only the metrics are uploaded, not the artefacts.',
  handler: async () =>
    process.exit(await (await import('./view-logs')).viewLogs()),
};
