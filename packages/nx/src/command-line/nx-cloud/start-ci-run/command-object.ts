import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsStartCiRunCommand: CommandModule = {
  command: 'start-ci-run [options]',
  describe:
    'Starts a new CI run for distributed task execution. This command is an alias for [`nx-cloud start-ci-run`](/ci/reference/nx-cloud-cli#npx-nxcloud-start-ci-run).',
  builder: (yargs) =>
    withVerbose(yargs)
      .option('help', { describe: 'Show help.', type: 'boolean', alias: 'h', global: false })
      .help(false)
      .showHelpOnFail(false),
  handler: async (args: any) => {
    process.exit(
      await (await import('./start-ci-run')).startCiRunHandler(args)
    );
  },
};
