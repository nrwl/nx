import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';

export const yargsFixCiCommand: CommandModule = {
  command: 'fix-ci [options]',
  describe:
    'Fixes CI failures. This command is an alias for [`nx-cloud fix-ci`](/ci/reference/nx-cloud-cli#npx-nxcloud-fix-ci).',
  builder: (yargs) =>
    withVerbose(yargs)
      .option('help', { describe: 'Show Help.', type: 'boolean' })
      .help(false)
      .showHelpOnFail(false),
  handler: async (args: any) => {
    process.exit(await (await import('./fix-ci')).fixCiHandler(args));
  },
};
