import { CommandModule, showHelp } from 'yargs';
import {
  withBatch,
  withOverrides,
  withRunOneOptions,
} from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/handle-errors';

export const yargsRunCommand: CommandModule = {
  command: 'run [project][:target][:configuration] [_..]',
  describe: `Run a target for a project
    (e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.`,
  builder: (yargs) => withRunOneOptions(withBatch(yargs)),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        await import('./run-one').then((m) =>
          m.runOne(process.cwd(), withOverrides(args))
        );
      }
    );
    process.exit(exitCode);
  },
};

/**
 * Handles the infix notation for running a target.
 */
export const yargsNxInfixCommand: CommandModule = {
  ...yargsRunCommand,
  command: '$0 <target> [project] [_..]',
  describe: 'Run a target for a project.',
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        // Yargs parses <target> as 'undefined' if running just 'nx'
        if (!args.target || args.target === 'undefined') {
          showHelp();
          process.exit(1);
        }
        return (await import('./run-one')).runOne(
          process.cwd(),
          withOverrides(args, 0)
        );
      }
    );
    process.exit(exitCode);
  },
};
