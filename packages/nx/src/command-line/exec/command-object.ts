import { CommandModule } from 'yargs';
import {
  withOverrides,
  withRunManyOptions,
  withTuiOptions,
} from '../yargs-utils/shared-options';
import { handleImport } from '../../utils/handle-import';

export const yargsExecCommand: CommandModule = {
  command: 'exec',
  describe: 'Executes any command as if it was a target on the project.',
  builder: (yargs) => withTuiOptions(withRunManyOptions(yargs)),
  handler: async (args) => {
    try {
      await (
        await handleImport('./exec.js', __dirname)
      ).nxExecCommand(withOverrides(args) as any);
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  },
};
