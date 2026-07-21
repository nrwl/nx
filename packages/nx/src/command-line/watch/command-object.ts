import { Argv, CommandModule } from 'yargs';
import { WatchArguments } from './watch';
import { handleImport } from '../../utils/handle-import';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { parseCSV, withVerbose } from '../yargs-utils/shared-options';

export const yargsWatchCommand: CommandModule = {
  command: 'watch',
  describe: 'Watch for changes within projects, and execute commands.',
  builder: (yargs) => linkToNxDevAndExamples(withWatchOptions(yargs), 'watch'),
  handler: async (args) => {
    await handleImport('./watch.js', __dirname).then((m) =>
      m.watch(args as WatchArguments)
    );
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
    .option('includeDependencies', {
      type: 'boolean',
      description:
        'When watching selected projects, also include the projects they depend on.',
      alias: 'd',
    })
    .option('includeGlobalWorkspaceFiles', {
      type: 'boolean',
      description:
        'Include global workspace files that are not part of a project. For example, the root eslint, or tsconfig file.',
      alias: 'g',
      hidden: true,
    })
    .option('include', {
      type: 'array',
      string: true,
      description:
        'Glob pattern for workspace-relative file paths that should re-trigger the watched command. A changed file must match at least one --include pattern to count. Pass multiple patterns space-delimited after one flag (e.g. `--include "**/*.ts" "**/*.html"`) or by repeating the flag; each value is one whole glob, so brace globs like `**/*.{ts,tsx}` are kept intact. When omitted, all changed files are included.',
    })
    .option('exclude', {
      type: 'array',
      string: true,
      description:
        'Glob pattern for workspace-relative file paths that should never re-trigger the watched command. A file matching any --exclude pattern is always skipped, even if it also matched --include. Pass multiple patterns space-delimited after one flag (e.g. `--exclude "**/*.spec.ts" "**/*.md"`) or by repeating the flag; each value is one whole glob.',
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
    .conflicts({
      all: 'projects',
    })
    .strictOptions()
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
