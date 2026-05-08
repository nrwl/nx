import { CommandModule } from 'yargs';
import { handleErrors } from '../../utils/handle-errors';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import {
  withBatch,
  withOutputStyleOption,
  withOverrides,
  withRunManyOptions,
  withTargetAndConfigurationOption,
  withTuiOptions,
} from '../yargs-utils/shared-options';
import { handleImport } from '../../utils/handle-import';
import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

export const yargsRunManyCommand: CommandModule = {
  command: 'run-many',
  describe: 'Run target for multiple listed projects.',
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withTuiOptions(
        withRunManyOptions(
          withOutputStyleOption(
            withTargetAndConfigurationOption(withBatch(yargs))
          )
        )
      ),
      'run-many'
    ),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        await handleImport('./run-many.js', __dirname).then((m) =>
          m.runMany(withOverrides(args))
        );
      }
    );
    process.exit(exitCode);
  },
};

// `nx run-many` — no positionals; project/target completion comes from
// flags. If yargs's alias declarations change, update the duplicates here.
registerCompletion('run-many', {
  flags: {
    projects: (current) => getProjectNameCompletions(current),
    p: (current) => getProjectNameCompletions(current),
    targets: (current) => getTargetNameCompletions(current),
    target: (current) => getTargetNameCompletions(current),
    t: (current) => getTargetNameCompletions(current),
  },
});
