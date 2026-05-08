import { CommandModule, showHelp } from 'yargs';
import { handleErrors } from '../../utils/handle-errors';
import { handleImport } from '../../utils/handle-import';
import {
  withBatch,
  withOverrides,
  withRunOneOptions,
  withTuiOptions,
} from '../yargs-utils/shared-options';
import { registerCompletion } from '../completion/metadata';
import {
  completeProjectTarget,
  getProjectNamesWithTarget,
} from '../completion/completion-providers';

export const yargsRunCommand: CommandModule = {
  command: 'run [project][:target][:configuration] [_..]',
  describe: `Run a target for a project
    (e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.`,
  builder: (yargs) => withTuiOptions(withRunOneOptions(withBatch(yargs))),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        await handleImport('./run-one.js', __dirname).then((m) =>
          m.runOne(process.cwd(), withOverrides(args))
        );
      }
    );
    process.exit(exitCode);
  },
};

// `nx run <project>:<target>` — single positional.
registerCompletion('run', {
  positionals: [{ complete: (current) => completeProjectTarget(current) }],
});

// Infix notation: `nx <target> <project>` — e.g. `nx build my-app`. Each
// target name is its own completion path. Suggestions filter to projects
// that actually have the target so e.g. `nx build <TAB>` skips projects
// without a build target.
const INFIX_TARGETS = [
  'build',
  'serve',
  'test',
  'lint',
  'e2e',
  'dev',
  'start',
  'preview',
  'typecheck',
] as const;

for (const targetName of INFIX_TARGETS) {
  registerCompletion(targetName, {
    positionals: [
      {
        complete: (current) => getProjectNamesWithTarget(current, targetName),
      },
    ],
  });
}

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
        return (await handleImport('./run-one.js', __dirname)).runOne(
          process.cwd(),
          withOverrides(args, 0)
        );
      }
    );
    process.exit(exitCode);
  },
};
