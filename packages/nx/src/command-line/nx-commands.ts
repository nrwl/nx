import * as chalk from 'chalk';
import { execSync } from 'child_process';
import * as path from 'path';
import * as yargs from 'yargs';
import { generateDaemonHelpOutput } from '../daemon/client/generate-help-output';
import { nxVersion } from '../utils/versions';
import { examples } from './examples';
import { workspaceRoot } from '../utils/app-root';
import { getPackageManagerCommand } from '../utils/package-manager';
import { writeJsonFile } from '../utils/fileutils';

const isGenerateDocsProcess = process.env.NX_GENERATE_DOCS_PROCESS === 'true';
const daemonHelpOutput = generateDaemonHelpOutput(isGenerateDocsProcess);

// Ensure that the output takes up the available width of the terminal
yargs.wrap(yargs.terminalWidth());

/**
 * Exposing the Yargs commands object so the documentation generator can
 * parse it. The CLI will consume it and call the `.argv` to bootstrapped
 * the CLI. These command declarations needs to be in a different file
 * from the `.argv` call, so the object and it's relative scripts can
 * le executed correctly.
 */
export const commandsObject = yargs
  .parserConfiguration({
    'strip-dashed': true,
    // allow parsing --env.SOME_ARG for cypress cli env args
    'dot-notation': true,
  })
  .usage(
    `
${chalk.bold('Smart, Fast and Extensible Build System')}` +
      (daemonHelpOutput
        ? `

${daemonHelpOutput}
  `.trimRight()
        : '')
  )
  .command({
    command: 'generate <generator> [_..]',
    describe:
      'Generate or update source code (e.g., nx generate @nrwl/js:lib mylib).',
    aliases: ['g'],
    builder: (yargs) => withGenerateOptions(yargs),
    handler: async (args) => {
      // Remove the command from the args
      args._ = args._.slice(1);
      process.exit(
        await (await import('./generate')).generate(process.cwd(), args)
      );
    },
  })
  .command({
    command: 'run [project][:target][:configuration] [_..]',
    describe: `Run a target for a project
    (e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.`,
    builder: (yargs) => withRunOneOptions(yargs),
    handler: async (args) =>
      (await import('./run-one')).runOne(process.cwd(), { ...args }),
  })
  .command({
    command: 'run-many',
    describe: 'Run target for multiple listed projects',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withRunManyOptions(withParallelOption(withTargetOption(yargs))),
        'run-many'
      ),
    handler: async (args) => (await import('./run-many')).runMany({ ...args }),
  })
  .command({
    command: 'affected',
    describe: 'Run target for affected projects',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withParallelOption(withTargetOption(yargs))),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', { ...args }),
  })
  .command({
    command: 'affected:test',
    describe: false,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withParallelOption(yargs)),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', {
        ...args,
        target: 'test',
      }),
  })
  .command({
    command: 'affected:build',
    describe: false,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withParallelOption(yargs)),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', {
        ...args,
        target: 'build',
      }),
  })
  .command({
    command: 'affected:lint',
    describe: false,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withParallelOption(yargs)),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', {
        ...args,
        target: 'lint',
      }),
  })
  .command({
    command: 'affected:e2e',
    describe: false,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withParallelOption(yargs)),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', {
        ...args,
        target: 'e2e',
      }),
  })
  .command({
    command: 'affected:apps',
    describe: 'Print applications affected by changes',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withPlainOption(yargs)),
        'affected:apps'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('apps', { ...args }),
  })
  .command({
    command: 'affected:libs',
    describe: 'Print libraries affected by changes',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withPlainOption(yargs)),
        'affected:libs'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('libs', {
        ...args,
      }),
  })
  .command({
    command: 'affected:graph',
    describe: 'Graph dependencies affected by changes',
    aliases: ['affected:dep-graph'],
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withDepGraphOptions(yargs)),
        'affected:graph'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('graph', {
        ...args,
      }),
  })
  .command({
    command: 'print-affected',
    describe:
      'Prints information about the projects and targets affected by changes',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withPrintAffectedOptions(yargs)),
        'print-affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('print-affected', {
        ...args,
      }),
  })
  .command({
    command: 'daemon',
    describe: 'Prints information about the Nx Daemon process',
    builder: (yargs) =>
      linkToNxDevAndExamples(withDaemonStartOptions(yargs), 'daemon'),
    handler: async (args) => (await import('./daemon')).daemonHandler(args),
  })

  .command({
    command: 'graph',
    describe: 'Graph dependencies within workspace',
    aliases: ['dep-graph'],
    builder: (yargs) =>
      linkToNxDevAndExamples(withDepGraphOptions(yargs), 'dep-graph'),
    handler: async (args) =>
      (await import('./dep-graph')).generateGraph(args as any, []),
  })

  .command({
    command: 'format:check',
    describe: 'Check for un-formatted files',
    builder: (yargs) =>
      linkToNxDevAndExamples(withFormatOptions(yargs), 'format:check'),
    handler: async (args) => (await import('./format')).format('check', args),
  })
  .command({
    command: 'format:write',
    describe: 'Overwrite un-formatted files',
    aliases: ['format'],
    builder: (yargs) =>
      linkToNxDevAndExamples(withFormatOptions(yargs), 'format:write'),
    handler: async (args) => (await import('./format')).format('write', args),
  })
  .command({
    command: 'workspace-lint [files..]',
    describe: 'Lint nx specific workspace files (nx.json, workspace.json)',
    handler: async () => (await import('./lint')).workspaceLint(),
  })

  .command({
    command: 'workspace-generator [name]',
    describe: 'Runs a workspace generator from the tools/generators directory',
    aliases: ['workspace-schematic [name]'],
    builder: async (yargs) =>
      linkToNxDevAndExamples(
        await withWorkspaceGeneratorOptions(yargs),
        'workspace-generator'
      ),
    handler: async () =>
      (await import('./workspace-generators')).workspaceGenerators(
        process.argv.slice(3)
      ),
  })
  .command({
    command: 'migrate [packageAndVersion]',
    describe: `Creates a migrations file or runs migrations from the migrations file.
- Migrate packages and create migrations.json (e.g., nx migrate @nrwl/workspace@latest)
- Run migrations (e.g., nx migrate --run-migrations=migrations.json)`,
    builder: (yargs) =>
      linkToNxDevAndExamples(withMigrationOptions(yargs), 'migrate'),
    handler: () => runMigration(),
  })
  .command({
    command: 'report',
    describe:
      'Reports useful version numbers to copy into the Nx issue template',
    handler: async () => (await import('./report')).reportHandler(),
  })
  .command({
    command: 'list [plugin]',
    describe:
      'Lists installed plugins, capabilities of installed plugins and other available plugins.',
    builder: (yargs) => withListOptions(yargs),
    handler: async (args: any) => (await import('./list')).listHandler(args),
  })
  .command({
    command: 'reset',
    describe:
      'Clears all the cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.',
    aliases: ['clear-cache'],
    handler: async () => (await import('./reset')).resetHandler(),
  })
  .command({
    command: 'connect-to-nx-cloud',
    describe: `Makes sure the workspace is connected to Nx Cloud`,
    builder: (yargs) => linkToNxDevAndExamples(yargs, 'connect-to-nx-cloud'),
    handler: async () =>
      (await import('./connect-to-nx-cloud')).connectToNxCloudCommand(),
  })
  .command({
    command: 'new [_..]',
    describe: false,
    builder: (yargs) => withNewOptions(yargs),
    handler: async (args) => {
      args._ = args._.slice(1);
      return (await import('./generate')).newWorkspace(
        args['nxWorkspaceRoot'] as string,
        args
      );
    },
  })
  .command(
    '_migrate [packageAndVersion]',
    false,
    (yargs) => withMigrationOptions(yargs),
    async (args) => (await import('./migrate')).migrate(process.cwd(), args)
  )
  .help('help')
  .version(nxVersion);

function withFormatOptions(yargs: yargs.Argv): yargs.Argv {
  return withAffectedOptions(yargs)
    .option('libs-and-apps', {
      describe: 'Format only libraries and applications files.',
      type: 'boolean',
    })
    .option('projects', {
      describe: 'Projects to format (comma delimited)',
      type: 'array',
      coerce: parseCSV,
    })
    .conflicts({
      all: 'projects',
    });
}

function withDaemonStartOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('background', { type: 'boolean', default: true });
}

function withPrintAffectedOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('select', {
    type: 'string',
    describe:
      'Select the subset of the returned json document (e.g., --selected=projects)',
  });
}

function withPlainOption(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('plain', {
    describe: 'Produces a plain output for affected:apps and affected:libs',
  });
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
    .option('uncommitted', {
      describe: 'Uncommitted changes',
      type: 'boolean',
      default: undefined,
    })
    .option('untracked', {
      describe: 'Untracked changes',
      type: 'boolean',
      default: undefined,
    })
    .option('all', {
      describe: 'All projects',
      type: 'boolean',
      default: undefined,
    })
    .option('base', {
      describe: 'Base of the current branch (usually main)',
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
      deprecated:
        'The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.',
      describe: 'Isolate projects which previously failed',
      type: 'boolean',
      default: false,
    })
    .option('verbose', {
      describe: 'Print additional error stack trace on failure',
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
      type: 'boolean',
      default: undefined,
    })
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
      deprecated:
        'Configure target dependencies instead. It will be removed in v14.',
    })
    .options('only-failed', {
      deprecated:
        'The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.',
      describe: 'Only run the target on projects which previously failed',
      type: 'boolean',
      default: false,
    })
    .option('exclude', {
      describe: 'Exclude certain projects from being processed',
      type: 'array',
      coerce: parseCSV,
      default: [],
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
        'Output file (e.g. --file=output.json or --file=dep-graph.html)',
      type: 'string',
    })
    .option('focus', {
      describe:
        'Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.',
      type: 'string',
    })
    .option('exclude', {
      describe:
        'List of projects delimited by commas to exclude from the project graph.',
      type: 'array',
      coerce: parseCSV,
    })
    .option('groupByFolder', {
      describe: 'Group projects by folder in the project graph',
      type: 'boolean',
    })
    .option('host', {
      describe: 'Bind the project graph server to a specific ip address.',
      type: 'string',
    })
    .option('port', {
      describe: 'Bind the project graph server to a specific port.',
      type: 'number',
    })
    .option('watch', {
      describe: 'Watch for changes to project graph and update in-browser',
      type: 'boolean',
      default: false,
    })
    .option('open', {
      describe: 'Open the project graph in the browser.',
      type: 'boolean',
      default: true,
    });
}

function withParallelOption(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('parallel', {
    describe: 'Max number of parallel processes [default is 3]',
    type: 'string',
  });
}

function withTargetOption(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('target', {
    describe: 'Task to run for affected projects',
    type: 'string',
    requiresArg: true,
    demandOption: true,
    global: false,
  });
}

function withNewOptions(yargs: yargs.Argv) {
  return yargs
    .option('nxWorkspaceRoot', {
      describe: 'The folder where the new workspace is going to be created',
      type: 'string',
      required: true,
    })
    .option('interactive', {
      describe: 'When false disables interactive input prompts for options',
      type: 'boolean',
      default: true,
    });
}

function withGenerateOptions(yargs: yargs.Argv) {
  const generatorWillShowHelp =
    process.argv[3] && !process.argv[3].startsWith('-');
  const res = yargs
    .positional('generator', {
      describe: 'Name of the generator (e.g., @nrwl/js:library, library)',
      type: 'string',
      required: true,
    })
    .option('dryRun', {
      describe: 'Preview the changes without updating files',
      alias: 'd',
      type: 'boolean',
      default: false,
    })
    .option('interactive', {
      describe: 'When false disables interactive input prompts for options',
      type: 'boolean',
      default: true,
    });

  if (generatorWillShowHelp) {
    return res.help(false);
  } else {
    return res.epilog(
      `Run "nx g collection:generator --help" to see information about the generator's schema.`
    );
  }
}

function withRunOneOptions(yargs: yargs.Argv) {
  const executorShouldShowHelp = !(
    process.argv[2] === 'run' && process.argv[3] === '--help'
  );
  const res = yargs
    .option('prod', {
      describe: 'Use the production configuration',
      type: 'boolean',
      default: false,
    })
    .option('configuration', {
      describe: 'Target configuration',
      alias: 'c',
      type: 'string',
    })
    .option('project', {
      describe: 'Target project',
      type: 'string',
    });

  if (executorShouldShowHelp) {
    return res.help(false);
  } else {
    return res.epilog(
      `Run "nx run myapp:mytarget --help" to see information about the executor's schema.`
    );
  }
}

async function withWorkspaceGeneratorOptions(yargs: yargs.Argv) {
  yargs
    .option('list-generators', {
      describe: 'List the available workspace-generators',
      type: 'boolean',
    })
    .positional('name', {
      type: 'string',
      describe: 'The name of your generator',
    });

  /**
   * Don't require `name` if only listing available
   * schematics
   */
  if ((await yargs.argv).listGenerators !== true) {
    yargs.demandOption('name');
  }
  return yargs;
}

function withMigrationOptions(yargs: yargs.Argv) {
  return yargs
    .positional('packageAndVersion', {
      describe: `The target package and version (e.g, @nrwl/workspace@13.0.0)`,
      type: 'string',
    })
    .option('runMigrations', {
      describe: `Execute migrations from a file (when the file isn't provided, execute migrations from migrations.json)`,
      type: 'string',
    })
    .option('from', {
      describe:
        'Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nrwl/react:12.0.0,@nrwl/js:12.0.0")',
      type: 'string',
    })
    .option('to', {
      describe:
        'Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nrwl/react:12.0.0,@nrwl/js:12.0.0")',
      type: 'string',
    });
}

function parseCSV(args: string[]) {
  if (!args) {
    return args;
  }
  return args
    .map((arg) => arg.split(','))
    .reduce((acc, value) => {
      return [...acc, ...value];
    }, [] as string[]);
}

function linkToNxDevAndExamples(yargs: yargs.Argv, command: string) {
  (examples[command] || []).forEach((t) => {
    yargs = yargs.example(t.command, t.description);
  });
  return yargs.epilog(
    chalk.bold(
      `Find more information and examples at https://nx.dev/cli/${command.replace(
        ':',
        '-'
      )}`
    )
  );
}

function withListOptions(yargs) {
  return yargs.positional('plugin', {
    type: 'string',
    description: 'The name of an installed plugin to query',
  });
}

function runMigration() {
  const runLocalMigrate = () => {
    const pmc = getPackageManagerCommand();
    execSync(`${pmc.exec} nx _migrate ${process.argv.slice(3).join(' ')}`, {
      stdio: ['inherit', 'inherit', 'inherit'],
    });
  };
  if (process.env.NX_MIGRATE_USE_LOCAL === undefined) {
    const p = nxCliPath();
    if (p === null) {
      runLocalMigrate();
    } else {
      execSync(`${p} _migrate ${process.argv.slice(3).join(' ')}`, {
        stdio: ['inherit', 'inherit', 'inherit'],
      });
    }
  } else {
    runLocalMigrate();
  }
}

function nxCliPath() {
  try {
    const packageManager = getPackageManagerCommand();

    const { dirSync } = require('tmp');
    const tmpDir = dirSync().name;
    const version =
      process.env.NX_MIGRATE_USE_NEXT === 'true' ? 'next' : 'latest';
    writeJsonFile(path.join(tmpDir, 'package.json'), {
      dependencies: {
        nx: version,
      },
      license: 'MIT',
    });

    execSync(packageManager.install, {
      cwd: tmpDir,
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    // Set NODE_PATH so that these modules can be used for module resolution
    addToNodePath(path.join(tmpDir, 'node_modules'));
    addToNodePath(path.join(workspaceRoot, 'node_modules'));

    return path.join(tmpDir, `node_modules`, '.bin', 'nx');
  } catch (e) {
    console.error(
      'Failed to install the latest version of the migration script. Using the current version.'
    );
    if (process.env.NX_VERBOSE_LOGGING) {
      console.error(e);
    }
    return null;
  }
}

function addToNodePath(dir: string) {
  // NODE_PATH is a delimited list of paths.
  // The delimiter is different for windows.
  const delimiter = require('os').platform() === 'win32' ? ';' : ':';

  const paths = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(delimiter)
    : [];

  // Add the tmp path
  paths.push(dir);

  // Update the env variable.
  process.env.NODE_PATH = paths.join(delimiter);
}
