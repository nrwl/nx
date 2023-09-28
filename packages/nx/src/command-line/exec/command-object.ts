import { CommandModule } from 'yargs';
import {
  withRunOneOptions,
  withOverrides,
} from '../yargs-utils/shared-options';

export const yargsExecCommand: CommandModule = {
  command: 'exec',
  describe: 'Executes any command as if it was a target on the project',
  builder: (yargs) => withRunOneOptions(yargs),
  handler: async (args) => {
    try {
      await (
        await import('./exec.js')
      ).nxExecCommand(withOverrides(args) as any);
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  },
};
