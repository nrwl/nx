import { CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import {
  withRunManyOptions,
  withOutputStyleOption,
  withTargetAndConfigurationOption,
  withOverrides,
} from '../yargs-utils/shared-options';

export const yargsRunManyCommand: CommandModule = {
  command: 'run-many',
  describe: 'Run target for multiple listed projects',
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withRunManyOptions(
        withOutputStyleOption(withTargetAndConfigurationOption(yargs))
      ),
      'run-many'
    ),
  handler: async (args) =>
    (await import('./run-many')).runMany(withOverrides(args)),
};
