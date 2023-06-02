import { ArgumentsCamelCase, CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';

export const yargsRepairCommand: CommandModule = {
  command: 'repair',
  describe: 'Repair any configuration that is no longer supported by Nx.',
  builder: (yargs) =>
    linkToNxDevAndExamples(yargs, 'repair').option('verbose', {
      type: 'boolean',
      describe:
        'Prints additional information about the commands (e.g., stack traces)',
    }),
  handler: async (args: ArgumentsCamelCase<{ verbose: boolean }>) =>
    process.exit(await (await import('./repair')).repair(args)),
};
