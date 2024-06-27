import { CommandModule } from 'yargs';
import { handleErrors } from '../../utils/params';
import {
  withAffectedOptions,
  withTargetAndConfigurationOption,
} from '../yargs-utils/shared-options';
import { withGraphOptions } from '../graph/command-object';

const affectedGraphDeprecationMessage =
  'Use `nx graph --affected`, or `nx affected --graph` instead depending on which best suits your use case. The `affected:graph` command has been removed in Nx 19.';
const printAffectedDeprecationMessage =
  'Use `nx show projects --affected`, `nx affected --graph -t build` or `nx graph --affected` depending on which best suits your use case. The `print-affected` command has been removed in Nx 19.';

/**
 * @deprecated 'Use `nx graph --affected`, or` nx affected --graph` instead depending on which best suits your use case. The `affected:graph` command will be removed in Nx 19.'
 */
export const yargsAffectedGraphCommand: CommandModule = {
  command: 'affected:graph',
  describe: false,
  aliases: ['affected:dep-graph'],
  builder: (yargs) => withAffectedOptions(withGraphOptions(yargs)),
  handler: async (args) => {
    const exitCode = await handleErrors(false, () => {
      throw new Error(affectedGraphDeprecationMessage);
    });
    process.exit(exitCode);
  },
  deprecated: affectedGraphDeprecationMessage,
};

/**
 * @deprecated 'Use `nx show --affected`, `nx affected --graph` or `nx graph --affected` depending on which best suits your use case. The `print-affected` command will be removed in Nx 19.'
 */
export const yargsPrintAffectedCommand: CommandModule = {
  command: 'print-affected',
  describe: false,
  builder: (yargs) =>
    withAffectedOptions(withTargetAndConfigurationOption(yargs, false))
      .option('select', {
        type: 'string',
        describe:
          'Select the subset of the returned json document (e.g., --select=projects)',
      })
      .option('type', {
        type: 'string',
        choices: ['app', 'lib'],
        describe:
          'Select the type of projects to be returned (e.g., --type=app)',
      }),
  handler: async (args) => {
    const exitCode = await handleErrors(false, () => {
      throw new Error(printAffectedDeprecationMessage);
    });
    process.exit(exitCode);
  },
  deprecated: printAffectedDeprecationMessage,
};
