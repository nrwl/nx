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
  return (
    withVerbose(yargs)
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
      // TODO(v24): remove the deprecated --includeDependentProjects alias
      .option('includeDependentProjects', {
        type: 'boolean',
        hidden: true,
        describe:
          "Deprecated in favor of --includeDependencies; will be removed in Nx 24. The flag name was misleading since it includes the watched project's dependencies, not its dependents. The new flag is functionally identical.",
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

        // --includeDependentProjects was renamed to --includeDependencies in
        // Nx 23 because the original name was misleading: it includes the
        // watched project's *dependencies*, not its dependents. The new flag
        // is functionally identical — only the name changed. Map the legacy
        // name through so existing scripts keep working during the
        // deprecation window.
        // TODO(v24): remove the legacy includeDependentProjects pass-through
        const a = args as Record<string, unknown>;
        if (
          a.includeDependentProjects !== undefined &&
          a.includeDependencies === undefined
        ) {
          a.includeDependencies = a.includeDependentProjects;
          // eslint-disable-next-line no-console
          console.warn(
            "--includeDependentProjects is deprecated in favor of --includeDependencies and will be removed in Nx 24. The flag name was misleading since it includes the watched project's dependencies, not its dependents. The new flag is functionally identical."
          );
        }
      }, true)
  );
}
