import { CommandModule } from 'yargs';
import {
  withOverrides,
  withRunManyOptions,
  withTuiOptions,
} from '../yargs-utils/shared-options';
import { exitAndFlushAnalytics } from '../../analytics/analytics';

export const yargsExecCommand: CommandModule = {
  command: 'exec',
  describe: 'Executes any command as if it was a target on the project.',
  builder: (yargs) => withTuiOptions(withRunManyOptions(yargs)),
  handler: async (args) => {
    try {
      await (await import('./exec')).nxExecCommand(withOverrides(args) as any);
      exitAndFlushAnalytics(0);
    } catch (e) {
      console.error(e);
      exitAndFlushAnalytics(1);
    }
  },
};
