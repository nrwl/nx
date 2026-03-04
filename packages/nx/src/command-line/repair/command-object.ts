import { ArgumentsCamelCase, CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withVerbose } from '../yargs-utils/shared-options';

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
  builder: (yargs) => linkToNxDevAndExamples(withVerbose(yargs), 'repair'),
  handler: async (args: ArgumentsCamelCase<{ verbose: boolean }>) =>
    process.exit(await (await import('./repair')).repair(args)),
};
