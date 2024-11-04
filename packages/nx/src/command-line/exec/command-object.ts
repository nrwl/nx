import { CommandModule } from 'yargs';
import {
  withOverrides,
  withRunManyOptions,
} from '../yargs-utils/shared-options';

export const yargsExecCommand: CommandModule = {
  command: 'exec',
  describe: 'Executes any command as if it was a target on the project.',
  builder: (yargs) => withRunManyOptions(yargs),
  handler: async (args) => {
    try {
      await (await import('./exec')).nxExecCommand(withOverrides(args) as any);
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  },
};
