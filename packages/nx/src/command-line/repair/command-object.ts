import { ArgumentsCamelCase, CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';

export const yargsRepairCommand: CommandModule = {
  command: 'repair',
  describe: `Repair any configuration that is no longer supported by Nx.

    Specifically, this will run every migration within the \`nx\` package
    against the current repository. Doing so should fix any configuration
    details left behind if the repository was previously updated to a new
    Nx version without using \`nx migrate\`.

    If your repository has only ever updated to newer versions of Nx with
    \`nx migrate\`, running \`nx repair\` should do nothing.
  `,
  builder: (yargs) =>
    linkToNxDevAndExamples(yargs, 'repair').option('verbose', {
      type: 'boolean',
      describe:
        'Prints additional information about the commands (e.g., stack traces)',
    }),
  handler: async (args: ArgumentsCamelCase<{ verbose: boolean }>) =>
    process.exit(await (await import('./repair')).repair(args)),
};
