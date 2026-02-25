import { CommandModule } from 'yargs';
import { withVerbose } from '../../yargs-utils/shared-options';
import { exitAndFlushAnalytics } from '../../../analytics/analytics';

export const yargsApplyLocallyCommand: CommandModule = {
  command: 'apply-locally [options]',
  describe:
    'Applies a self-healing CI fix locally. This command is an alias for `nx-cloud apply-locally`.',
  builder: (yargs) =>
    withVerbose(yargs)
      .help(false)
      .showHelpOnFail(false)
      .option('help', { describe: 'Show help.', type: 'boolean' }),
  handler: async (args: any) => {
    exitAndFlushAnalytics(
      await (await import('./apply-locally')).applyLocallyHandler(args)
    );
  },
};
