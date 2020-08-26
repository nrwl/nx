#!/usr/bin/env node
import { execSync } from 'child_process';
import { platform } from 'os';
import * as yargs from 'yargs';
import { nxVersion } from '../utils/versions';
import { generateGraph } from './dep-graph';
import { format } from './format';
import { workspaceLint } from './lint';
import { list } from './list';
import { report } from './report';
import { workspaceSchematic } from './workspace-schematic';
import { affected } from './affected';
import { runMany } from './run-many';

const noop = (yargs: yargs.Argv): yargs.Argv => yargs;

/**
 * Exposing the Yargs commands object so the documentation generator can
 * parse it. The CLI will consume it and call the `.argv` to bootstrapped
 * the CLI. These command declarations needs to be in a different file
 * from the `.argv` call, so the object and it's relative scripts can
 * be executed correctly.
 */
export const commandsObject = yargs
  .usage('Extensible Dev Tools for Monorepos')
  .command(
    'run [project][:target][:configuration] [options, ...]',
    `
    Run a target for a project
    (e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)
    `
  )
  .command(
    'generate [schematic-collection:][schematic] [options, ...]',
    `
    Generate code
    (e.g., nx generate @nrwl/web:app myapp).
    `
  )
  .command(
    'affected',
    'Run task for affected projects',
    (yargs) => withAffectedOptions(withParallel(withTarget(yargs))),
    (args) => affected('affected', { ...args })
  )
  .command(
    'run-many',
    'Run task for multiple projects',
    (yargs) => withRunManyOptions(withParallel(withTarget(yargs))),
    (args) => runMany({ ...args })
  )
  .command(
    'affected:apps',
    'Print applications affected by changes',
    withAffectedOptions,
    (args) => affected('apps', { ...args })
  )
  .command(
    'affected:libs',
    'Print libraries affected by changes',
    withAffectedOptions,
    (args) =>
      affected('libs', {
        ...args,
      })
  )
  .command(
    'affected:build',
    'Build applications and publishable libraries affected by changes',
    (yargs) => withAffectedOptions(withParallel(yargs)),
    (args) =>
      affected('affected', {
        ...args,
        target: 'build',
      })
  )
  .command(
    'affected:test',
    'Test projects affected by changes',
    (yargs) => withAffectedOptions(withParallel(yargs)),
    (args) =>
      affected('affected', {
        ...args,
        target: 'test',
      })
  )
  .command(
    'affected:e2e',
    'Run e2e tests for the applications affected by changes',
    (yargs) => withAffectedOptions(withParallel(yargs)),
    (args) =>
      affected('affected', {
        ...args,
        target: 'e2e',
      })
  )
  .command(
    'affected:dep-graph',
    'Graph dependencies affected by changes',
    (yargs) => withAffectedOptions(withDepGraphOptions(yargs)),
    (args) =>
      affected('dep-graph', {
        ...args,
      })
  )
  .command(
    'print-affected',
    'Graph execution plan',
    (yargs) => withAffectedOptions(withPrintAffectedOptions(yargs)),
    (args) =>
      affected('print-affected', {
        ...args,
      })
  )
  .command(
    'affected:lint',
    'Lint projects affected by changes',
    (yargs) => withAffectedOptions(withParallel(yargs)),
    (args) =>
      affected('affected', {
        ...args,
        target: 'lint',
      })
  )
  .command(
    'dep-graph',
    'Graph dependencies within workspace',
    (yargs) => withDepGraphOptions(yargs),
    (args) => generateGraph(args as any, [])
  )
  .command(
    'format:check',
    'Check for un-formatted files',
    withFormatOptions,
    (args) => format('check', args)
  )
  .command(
    'format:write',
    'Overwrite un-formatted files',
    withFormatOptions,
    (args) => format('write', args)
  )
  .alias('format:write', 'format')
  .command(
    'workspace-lint [files..]',
    'Lint workspace or list of files.  Note: To exclude files from this lint rule, you can add them to the ".nxignore" file',
    noop,
    (_) => workspaceLint()
  )
  .command(
    'workspace-schematic [name]',
    'Runs a workspace schematic from the tools/schematics directory',
    (yargs) => {
      yargs.option('list-schematics', {
        describe: 'List the available workspace-schematics',
        type: 'boolean',
      });
      /**
       * Don't require `name` if only listing available
       * schematics
       */
      if (yargs.argv.listSchematics !== true) {
        yargs.demandOption(['name']).positional('name', {
          type: 'string',
          describe: 'The name of your schematic`',
        });
      }
      return yargs;
    },
    () => workspaceSchematic(process.argv.slice(3))
  )
  .command(
    'migrate',
    `Creates a migrations file or runs migrations from the migrations file.
- Migrate packages and create migrations.json (e.g., nx migrate @nrwl/workspace@latest)
- Run migrations (e.g., nx migrate --run-migrations=migrations.json)
    `,
    (yargs) => yargs,
    () => {
      const executable =
        platform() === 'win32'
          ? `.\\node_modules\\.bin\\tao`
          : `./node_modules/.bin/tao`;
      execSync(`${executable} migrate ${process.argv.slice(3).join(' ')}`, {
        stdio: ['inherit', 'inherit', 'inherit'],
      });
    }
  )
  .command(report)
  .command(list)
  .help('help')
  .version(nxVersion)
  .option('quiet', { type: 'boolean', hidden: true });

function withFormatOptions(yargs: yargs.Argv): yargs.Argv {
  return withAffectedOptions(yargs).option('libs-and-apps', {
    type: 'boolean',
  });
}

function withPrintAffectedOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('select', { type: 'string' });
}

function withAffectedOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('files', {
      describe:
        'Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas',
      type: 'array',
      requiresArg: true,
      coerce: parseCSV,
    })
    .option('uncommitted', { describe: 'Uncommitted changes' })
    .option('untracked', { describe: 'Untracked changes' })
    .option('all', { describe: 'All projects' })
    .option('base', {
      describe: 'Base of the current branch (usually master)',
      type: 'string',
      requiresArg: true,
    })
    .option('head', {
      describe: 'Latest commit of the current branch (usually HEAD)',
      type: 'string',
      requiresArg: true,
    })
    .group(
      ['base'],
      'Run command using --base=[SHA1] (affected by the committed, uncommitted and untracked changes):'
    )
    .group(
      ['base', 'head'],
      'or using --base=[SHA1] --head=[SHA2] (affected by the committed changes):'
    )
    .group(['files', 'uncommitted', 'untracked'], 'or using:')
    .implies('head', 'base')
    .nargs('uncommitted', 0)
    .nargs('untracked', 0)
    .nargs('all', 0)
    .option('exclude', {
      describe: 'Exclude certain projects from being processed',
      type: 'array',
      coerce: parseCSV,
      default: [],
    })
    .options('runner', {
      describe: 'This is the name of the tasks runner configured in nx.json',
      type: 'string',
    })
    .options('skip-nx-cache', {
      describe:
        'Rerun the tasks even when the results are available in the cache',
      type: 'boolean',
      default: false,
    })
    .options('configuration', {
      describe:
        'This is the configuration to use when performing tasks on projects',
      type: 'string',
    })
    .options('only-failed', {
      describe: 'Isolate projects which previously failed',
      type: 'boolean',
      default: false,
    })
    .option('verbose', {
      describe: 'Print additional error stack trace on failure',
    })
    .option('plain', {
      describe: 'Produces a plain output for affected:apps and affected:libs',
    })
    .conflicts({
      files: ['uncommitted', 'untracked', 'base', 'head', 'all'],
      untracked: ['uncommitted', 'files', 'base', 'head', 'all'],
      uncommitted: ['files', 'untracked', 'base', 'head', 'all'],
      all: ['files', 'untracked', 'uncommitted', 'base', 'head'],
    });
}

function withRunManyOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('projects', {
      describe: 'Projects to run (comma delimited)',
      type: 'string',
    })
    .option('all', {
      describe: 'Run the target on all projects in the workspace',
    })
    .nargs('all', 0)
    .check(({ all, projects }) => {
      if ((all && projects) || (!all && !projects))
        throw new Error('You must provide either --all or --projects');
      return true;
    })
    .options('runner', {
      describe: 'Override the tasks runner in `nx.json`',
      type: 'string',
    })
    .options('skip-nx-cache', {
      describe:
        'Rerun the tasks even when the results are available in the cache',
      type: 'boolean',
      default: false,
    })
    .options('configuration', {
      describe:
        'This is the configuration to use when performing tasks on projects',
      type: 'string',
    })
    .options('with-deps', {
      describe:
        'Include dependencies of specified projects when computing what to run',
      type: 'boolean',
      default: false,
    })
    .options('only-failed', {
      describe: 'Only run the target on projects which previously failed',
      type: 'boolean',
      default: false,
    })
    .option('verbose', {
      describe: 'Print additional error stack trace on failure',
    })
    .conflicts({
      all: 'projects',
    });
}

function withDepGraphOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('file', {
      describe:
        'output file (e.g. --file=output.json or --file=dep-graph.html)',
      type: 'string',
    })
    .option('focus', {
      describe:
        'Use to show the dependency graph for a particular project and every node that is either an ancestor or a descendant.',
      type: 'string',
    })
    .option('exclude', {
      describe:
        'List of projects delimited by commas to exclude from the dependency graph.',
      type: 'array',
      coerce: parseCSV,
    })
    .option('groupByFolder', {
      describe: 'Group projects by folder in dependency graph',
      type: 'boolean',
    })
    .option('host', {
      describe: 'Bind the dep graph server to a specific ip address.',
      type: 'string',
    });
}

function parseCSV(args: string[]) {
  return args
    .map((arg) => arg.split(','))
    .reduce((acc, value) => {
      return [...acc, ...value];
    }, [] as string[]);
}

function withParallel(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('parallel', {
      describe: 'Parallelize the command',
      type: 'boolean',
      default: false,
    })
    .option('maxParallel', {
      describe:
        'Max number of parallel processes. This flag is ignored if the parallel option is set to `false`.',
      type: 'number',
      default: 3,
    });
}

function withTarget(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('target', {
    describe: 'Task to run for affected projects',
    type: 'string',
    requiresArg: true,
    demandOption: true,
    global: false,
  });
}
