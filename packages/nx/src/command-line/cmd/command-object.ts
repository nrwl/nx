import { CommandModule } from 'yargs';
import {
  parseCSV,
  withExcludeOption,
  withOverrides,
} from '../yargs-utils/shared-options';

export const yargsCmdCommand: CommandModule = {
  command: 'cmd',
  describe: 'Executes a command in the root directory of projects',
  builder: (yargs) =>
    withExcludeOption(yargs)
      .parserConfiguration({
        'strip-dashed': true,
        'populate--': true,
      })
      .option('projects', {
        type: 'string',
        alias: 'p',
        coerce: parseCSV,
        description:
          'Projects on which to execute the command (comma/space delimited).',
      })
      .option('all', {
        type: 'boolean',
        description: 'Watch all projects.',
      })
      .option('verbose', {
        type: 'boolean',
        description:
          'Run in verbose mode, where the arguments and projects to run are logged before execution.',
      })
      .option('parallel', {
        describe: 'Max number of parallel commands [default is 3]',
        type: 'string',
      })
      .conflicts({
        all: 'projects',
      })
      .check((args) => {
        if (!args.all && !args.projects) {
          throw Error('Please specify either --all or --projects');
        }

        return true;
      })
      .middleware((args) => {
        const { '--': doubledash } = args;
        if (doubledash && Array.isArray(doubledash)) {
          args.command = (doubledash as string[]).join(' ');
        } else {
          throw Error('Please specify a command to run with --');
        }
      }, true),
  handler: async (args) => {
    try {
      await (await import('./cmd-command')).cmdCommand(withOverrides(args));
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  },
};
