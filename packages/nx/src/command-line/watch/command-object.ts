import { Argv, CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { parseCSV, withVerbose } from '../yargs-utils/shared-options';
import { WatchArguments } from './watch';

export const yargsWatchCommand: CommandModule = {
  command: 'watch',
  describe: 'Watch for changes within projects, and execute commands.',
  builder: (yargs) => linkToNxDevAndExamples(withWatchOptions(yargs), 'watch'),
  handler: async (args) => {
    await import('./watch').then((m) => m.watch(args as WatchArguments));
  },
};

function withWatchOptions(yargs: Argv) {
  return withVerbose(yargs)
    .parserConfiguration({
      'strip-dashed': true,
      'populate--': true,
    })
    .option('projects', {
      type: 'string',
      alias: 'p',
      coerce: parseCSV,
      description: 'Projects to watch (comma/space delimited).',
    })
    .option('all', {
      type: 'boolean',
      description: 'Watch all projects.',
    })
    .option('includeDependentProjects', {
      type: 'boolean',
      description:
        'When watching selected projects, include dependent projects as well.',
      alias: 'd',
    })
    .option('includeGlobalWorkspaceFiles', {
      type: 'boolean',
      description:
        'Include global workspace files that are not part of a project. For example, the root eslint, or tsconfig file.',
      alias: 'g',
      hidden: true,
    })
    .option('command', { type: 'string', hidden: true })
    .option('verbose', {
      type: 'boolean',
      description:
        'Run watch mode in verbose mode, where commands are logged before execution.',
    })
    .option('initialRun', {
      type: 'boolean',
      description: 'Run the command once before watching for changes.',
      alias: 'i',
      default: false,
    })
    .option('executionStrategy', {
      type: 'string',
      description:
        "Execution strategy to use when running commands in watch mode. 'batch' will queue up changes and run the command once after changes have settled. 'persistent' will start a persistent process for each project and restart it when changes are detected.",
      choices: ['batch', 'persistent'],
      default: 'batch',
    })
    .option('maxParallel', {
      type: 'number',
      description:
        "Maximum number of concurrent persistent processes. Only applies when 'executionStrategy' is 'persistent'. Default: 3.",
      default: 3,
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
        throw Error('No command specified for watch mode.');
      }
    }, true);
}
