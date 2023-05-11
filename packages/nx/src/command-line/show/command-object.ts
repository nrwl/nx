import { CommandModule } from 'yargs';
import { withAffectedOptions } from '../yargs-utils/shared-options';
import { ShowProjectOptions } from './show';

export const yargsShowCommand: CommandModule = {
  command: 'show',
  describe: 'Show information about the workspace (e.g., list of projects)',
  builder: (yargs) => yargs.command(showProjectsCommand).demandCommand(),
  handler: async (args) => {
    // Noop, yargs will error if not in a subcommand.
  },
};

const showProjectsCommand: CommandModule<
  Record<string, unknown>,
  ShowProjectOptions
> = {
  command: 'projects',
  describe: 'Show a list of projects in the workspace',
  builder: (yargs) =>
    withAffectedOptions(yargs)
      .option('affected', {
        type: 'boolean',
        description: 'Show only affected projects',
      }),
  handler: (args) => import('./show').then((m) => m.showProjectsHandler(args)),
};
