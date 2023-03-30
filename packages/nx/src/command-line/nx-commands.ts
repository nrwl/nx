import * as chalk from 'chalk';
import { execSync } from 'child_process';
import * as path from 'path';
import * as yargs from 'yargs';
import { nxVersion } from '../utils/versions';
import { examples } from './examples';
import { workspaceRoot } from '../utils/workspace-root';
import { getPackageManagerCommand } from '../utils/package-manager';
import { writeJsonFile } from '../utils/fileutils';
import { WatchArguments } from './watch';
import { runNxSync } from '../utils/child-process';
import { stripIndents } from '../utils/strip-indents';

// Ensure that the output takes up the available width of the terminal.
yargs.wrap(yargs.terminalWidth());

export const parserConfiguration: Partial<yargs.ParserConfigurationOptions> = {
  'strip-dashed': true,
};

/**
 * Exposing the Yargs commands object so the documentation generator can
 * parse it. The CLI will consume it and call the `.argv` to bootstrapped
 * the CLI. These command declarations needs to be in a different file
 * from the `.argv` call, so the object and it's relative scripts can
 * le executed correctly.
 */
export const commandsObject = yargs
  .parserConfiguration(parserConfiguration)
  .usage(chalk.bold('Smart, Fast and Extensible Build System'))
  .demandCommand(1, '')
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
      (await import('./run-one')).runOne(process.cwd(), withOverrides(args)),
  })
  .command({
    command: 'run-many',
    describe: 'Run target for multiple listed projects',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withRunManyOptions(
          withOutputStyleOption(withTargetAndConfigurationOption(yargs))
        ),
        'run-many'
      ),
    handler: async (args) =>
      (await import('./run-many')).runMany(withOverrides(args)),
  })
  .command({
    command: 'affected',
    describe: 'Run target for affected projects',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(
          withRunOptions(
            withOutputStyleOption(withTargetAndConfigurationOption(yargs))
          )
        ),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', withOverrides(args)),
  })
  .command({
    command: 'affected:test',
    describe: false,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(
          withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
        ),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', {
        ...withOverrides(args),
        target: 'test',
      }),
  })
  .command({
    command: 'affected:build',
    describe: false,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(
          withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
        ),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', {
        ...withOverrides(args),
        target: 'build',
      }),
  })
  .command({
    command: 'affected:lint',
    describe: false,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(
          withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
        ),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', {
        ...withOverrides(args),
        target: 'lint',
      }),
  })
  .command({
    command: 'affected:e2e',
    describe: false,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(
          withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
        ),
        'affected'
      ),
    handler: async (args) =>
      (await import('./affected')).affected('affected', {
        ...withOverrides(args),
        target: 'e2e',
      }),
  })
  .command({
    command: 'affected:apps',
    deprecated:
      'Use `nx print-affected --type=app --select=projects` instead. This command will be removed in v15.',
    describe: `Print applications affected by changes`,
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withPlainOption(yargs)),
        'affected:apps'
      ),
    handler: async (args) => {
      await (await import('./affected')).affected('apps', { ...args });
      process.exit(0);
    },
  })
  .command({
    command: 'affected:libs',
    deprecated:
      'Use `nx print-affected --type=lib --select=projects` instead. This command will be removed in v15.',
    describe: 'Print libraries affected by changes',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(withPlainOption(yargs)),
        'affected:libs'
      ),
    handler: async (args) => {
      await (
        await import('./affected')
      ).affected('libs', {
        ...args,
      });
      process.exit(0);
    },
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
      await (
        await import('./affected')
      ).affected('graph', {
        ...args,
      }),
  })
  .command({
    command: 'print-affected',
    describe:
      'Prints information about the projects and targets affected by changes',
    builder: (yargs) =>
      linkToNxDevAndExamples(
        withAffectedOptions(
          withTargetAndConfigurationOption(
            withPrintAffectedOptions(yargs),
            false
          )
        ),
        'print-affected'
      ),
    handler: async (args) => {
      await (
        await import('./affected')
      ).affected('print-affected', withOverrides(args));
      process.exit(0);
    },
  })
  .command({
    command: 'daemon',
    describe:
      'Prints information about the Nx Daemon process or starts a daemon process',
    builder: (yargs) =>
      linkToNxDevAndExamples(withDaemonOptions(yargs), 'daemon'),
    handler: async (args) => (await import('./daemon')).daemonHandler(args),
  })

  .command({
    command: 'graph',
    describe: 'Graph dependencies within workspace',
    aliases: ['dep-graph'],
    builder: (yargs) =>
      linkToNxDevAndExamples(withDepGraphOptions(yargs), 'dep-graph'),
    handler: async (args) =>
      await (await import('./dep-graph')).generateGraph(args as any, []),
  })

  .command({
    command: 'format:check',
    describe: 'Check for un-formatted files',
    builder: (yargs) =>
      linkToNxDevAndExamples(withFormatOptions(yargs), 'format:check'),
    handler: async (args) => {
      await (await import('./format')).format('check', args);
      process.exit(0);
    },
  })
  .command({
    command: 'format:write',
    describe: 'Overwrite un-formatted files',
    aliases: ['format'],
    builder: (yargs) =>
      linkToNxDevAndExamples(withFormatOptions(yargs), 'format:write'),
    handler: async (args) => {
      await (await import('./format')).format('write', args);
      process.exit(0);
    },
  })
  .command({
    command: 'workspace-lint [files..]',
    describe: 'Lint nx specific workspace files (nx.json, workspace.json)',
    handler: async () => {
      await (await import('./lint')).workspaceLint();
      process.exit(0);
    },
  })

  .command({
    command: 'workspace-generator [name]',
    describe: 'Runs a workspace generator from the tools/generators directory',
    aliases: ['workspace-schematic [name]'],
    builder: async (yargs) =>
      linkToNxDevAndExamples(
        await withWorkspaceGeneratorOptions(yargs, process.argv.slice(3)),
        'workspace-generator'
      ),
    handler: workspaceGeneratorHandler,
  })
  .command({
    command: 'migrate [packageAndVersion]',
    describe: `Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nrwl/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.`,
    builder: (yargs) =>
      linkToNxDevAndExamples(withMigrationOptions(yargs), 'migrate'),
    handler: () => {
      runMigration();
      process.exit(0);
    },
  })
  .command({
    command: 'report',
    describe:
      'Reports useful version numbers to copy into the Nx issue template',
    handler: async () => {
      await (await import('./report')).reportHandler();
      process.exit(0);
    },
  })
  .command({
    command: 'init',
    describe: 'Adds nx.json file and installs nx if not installed already',
    handler: async () => {
      await (await import('./init')).initHandler();
      process.exit(0);
    },
  })
  .command({
    command: 'list [plugin]',
    describe:
      'Lists installed plugins, capabilities of installed plugins and other available plugins.',
    builder: (yargs) => withListOptions(yargs),
    handler: async (args: any) => {
      await (await import('./list')).listHandler(args);
      process.exit(0);
    },
  })
  .command({
    command: 'reset',
    describe:
      'Clears all the cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.',
    aliases: ['clear-cache'],
    handler: async () => (await import('./reset')).resetHandler(),
  })
  .command({
    command: 'connect',
    aliases: ['connect-to-nx-cloud'],
    describe: `Connect workspace to Nx Cloud`,
    builder: (yargs) => linkToNxDevAndExamples(yargs, 'connect-to-nx-cloud'),
    handler: async () => {
      await (await import('./connect')).connectToNxCloudCommand();
      process.exit(0);
    },
  })
  .command({
    command: 'new [_..]',
    describe: false,
    builder: (yargs) => withNewOptions(yargs),
    handler: async (args) => {
      args._ = args._.slice(1);
      process.exit(
        await (
          await import('./new')
        ).newWorkspace(args['nxWorkspaceRoot'] as string, args)
      );
    },
  })
  .command({
    command: '_migrate [packageAndVersion]',
    describe: false,
    builder: (yargs) => withMigrationOptions(yargs),
    handler: async (args) =>
      process.exit(
        await (
          await import('./migrate')
        ).migrate(process.cwd(), args, process.argv.slice(3))
      ),
  })
  .command({
    command: 'repair',
    describe: 'Repair any configuration that is no longer supported by Nx.',
    builder: (yargs) =>
      linkToNxDevAndExamples(yargs, 'repair').option('verbose', {
        type: 'boolean',
        describe:
          'Prints additional information about the commands (e.g., stack traces)',
      }),
    handler: async (args) =>
      process.exit(await (await import('./repair')).repair(args)),
  })
  .command({
    command: 'view-logs',
    describe:
      'Enables you to view and interact with the logs via the advanced analytic UI from Nx Cloud to help you debug your issue. To do this, Nx needs to connect your workspace to Nx Cloud and upload the most recent run details. Only the metrics are uploaded, not the artefacts.',
    handler: async () =>
      process.exit(await (await import('./view-logs')).viewLogs()),
  })
  .command({
    command: 'exec',
    describe: 'Executes any command as if it was a target on the project',
    builder: (yargs) => withRunOneOptions(yargs),
    handler: async (args) => {
      try {
        await (await import('./exec')).nxExecCommand(withOverrides(args));
        process.exit(0);
      } catch (e) {
        process.exit(1);
      }
    },
  })
  .command({
    command: 'watch',
    describe: 'Watch for changes within projects, and execute commands',
    builder: (yargs) =>
      linkToNxDevAndExamples(withWatchOptions(yargs), 'watch'),
    handler: async (args) => {
      await import('./watch').then((m) => m.watch(args as WatchArguments));
    },
  })
  .command({
    command: 'show <object>',
    describe: 'Show information about the workspace (e.g., list of projects)',
    builder: (yargs) => withShowOptions(yargs),
    handler: async (args) => {
      await import('./show').then((m) => m.show(args as any));
      process.exit(0);
    },
  })
  .scriptName('nx')
  .help()
  // NOTE: we handle --version in nx.ts, this just tells yargs that the option exists
  // so that it shows up in help. The default yargs implementation of --version is not
  // hit, as the implementation in nx.ts is hit first and calls process.exit(0).
  .version();

function withShowOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs.positional('object', {
    describe: 'What to show (e.g., projects)',
    choices: ['projects'],
    required: true,
  });
}

function withFormatOptions(yargs: yargs.Argv): yargs.Argv {
  return withAffectedOptions(yargs)
    .parserConfiguration({
      'camel-case-expansion': true,
    })
    .option('libs-and-apps', {
      describe: 'Format only libraries and applications files.',
      type: 'boolean',
    })
    .option('projects', {
      describe: 'Projects to format (comma/space delimited)',
      type: 'string',
      coerce: parseCSV,
    })
    .conflicts({
      all: 'projects',
    });
}

function withDaemonOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('start', {
      type: 'boolean',
      default: false,
    })
    .option('stop', {
      type: 'boolean',
      default: false,
    });
}

function withPrintAffectedOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('select', {
      type: 'string',
      describe:
        'Select the subset of the returned json document (e.g., --select=projects)',
    })
    .option('type', {
      type: 'string',
      choices: ['app', 'lib'],
      describe: 'Select the type of projects to be returned (e.g., --type=app)',
    });
}

function withPlainOption(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('plain', {
    describe: 'Produces a plain output for affected:apps and affected:libs',
  });
}

function withExcludeOption(yargs: yargs.Argv): yargs.Argv {
  return yargs.option('exclude', {
    describe: 'Exclude certain projects from being processed',
    type: 'string',
    coerce: parseCSV,
    default: '',
  });
}

function withRunOptions(yargs: yargs.Argv): yargs.Argv {
  return withExcludeOption(yargs)
    .option('parallel', {
      describe: 'Max number of parallel processes [default is 3]',
      type: 'string',
    })
    .option('maxParallel', {
      type: 'number',
      hidden: true,
    })
    .options('runner', {
      describe: 'This is the name of the tasks runner configured in nx.json',
      type: 'string',
    })
    .option('prod', {
      describe: 'Use the production configuration',
      type: 'boolean',
      default: false,
      hidden: true,
    })
    .option('graph', {
      type: 'boolean',
      describe: 'Show the task graph of the command',
      default: false,
    })
    .option('verbose', {
      type: 'boolean',
      describe:
        'Prints additional information about the commands (e.g., stack traces)',
    })
    .option('nx-bail', {
      describe: 'Stop command execution after the first failed task',
      type: 'boolean',
      default: false,
    })
    .option('nx-ignore-cycles', {
      describe: 'Ignore cycles in the task graph',
      type: 'boolean',
      default: false,
    })
    .options('skip-nx-cache', {
      describe:
        'Rerun the tasks even when the results are available in the cache',
      type: 'boolean',
      default: false,
    })
    .options('cloud', {
      type: 'boolean',
      hidden: true,
    })
    .options('dte', {
      type: 'boolean',
      hidden: true,
    });
}

function withAffectedOptions(yargs: yargs.Argv): yargs.Argv {
  return withExcludeOption(yargs)
    .parserConfiguration({
      'strip-dashed': true,
      'unknown-options-as-args': true,
      'populate--': true,
    })
    .option('files', {
      describe:
        'Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces',
      type: 'string',
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
    .conflicts({
      files: ['uncommitted', 'untracked', 'base', 'head', 'all'],
      untracked: ['uncommitted', 'files', 'base', 'head', 'all'],
      uncommitted: ['files', 'untracked', 'base', 'head', 'all'],
      all: ['files', 'untracked', 'uncommitted', 'base', 'head'],
    });
}

function withRunManyOptions(yargs: yargs.Argv): yargs.Argv {
  return withRunOptions(yargs)
    .parserConfiguration({
      'strip-dashed': true,
      'unknown-options-as-args': true,
      'populate--': true,
    })
    .option('projects', {
      type: 'string',
      alias: 'p',
      coerce: parseCSV,
      describe:
        'Projects to run. (comma/space delimited project names and/or patterns)',
    })
    .option('all', {
      describe: '[deprecated] Run the target on all projects in the workspace',
      type: 'boolean',
      default: true,
    });
}

function withDepGraphOptions(yargs: yargs.Argv): yargs.Argv {
  return yargs
    .option('file', {
      describe:
        'Output file (e.g. --file=output.json or --file=dep-graph.html)',
      type: 'string',
    })
    .option('view', {
      describe: 'Choose whether to view the projects or task graph',
      type: 'string',
      default: 'projects',
      choices: ['projects', 'tasks'],
    })
    .option('targets', {
      describe: 'The target to show tasks for in the task graph',
      type: 'string',
      coerce: parseCSV,
    })
    .option('focus', {
      describe:
        'Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.',
      type: 'string',
    })
    .option('exclude', {
      describe:
        'List of projects delimited by commas to exclude from the project graph.',
      type: 'string',
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

function withOverrides(args: any): any {
  args.__overrides_unparsed__ = (args['--'] ?? args._.slice(1)).map((v) =>
    v.toString()
  );
  delete args['--'];
  delete args._;
  return args;
}

function withOutputStyleOption(
  yargs: yargs.Argv,
  choices = ['dynamic', 'static', 'stream', 'stream-without-prefixes']
): yargs.Argv {
  return yargs.option('output-style', {
    describe: 'Defines how Nx emits outputs tasks logs',
    type: 'string',
    choices,
  });
}

function withTargetAndConfigurationOption(
  yargs: yargs.Argv,
  demandOption = true
): yargs.Argv {
  return withConfiguration(yargs).option('targets', {
    describe: 'Tasks to run for affected projects',
    type: 'string',
    alias: ['target', 't'],
    requiresArg: true,
    coerce: parseCSV,
    demandOption,
    global: false,
  });
}

function withConfiguration(yargs: yargs.Argv) {
  return yargs.options('configuration', {
    describe:
      'This is the configuration to use when performing tasks on projects',
    type: 'string',
    alias: 'c',
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
    })
    .option('verbose', {
      describe:
        'Prints additional information about the commands (e.g., stack traces)',
      type: 'boolean',
    })
    .option('quiet', {
      describe: 'Hides logs from tree operations (e.g. `CREATE package.json`)',
      type: 'boolean',
      conflicts: ['verbose'],
    })
    .middleware((args) => {
      if (process.env.NX_INTERACTIVE === 'false') {
        args.interactive = false;
      } else {
        process.env.NX_INTERACTIVE = `${args.interactive}`;
      }
      if (process.env.NX_DRY_RUN === 'true') {
        args.dryRun = true;
      } else {
        process.env.NX_DRY_RUN = `${args.dryRun}`;
      }
      if (process.env.NX_GENERATE_QUIET === 'true') {
        args.quiet = true;
      } else {
        process.env.NX_GENERATE_QUIET = `${args.quiet}`;
      }
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

  const res = withRunOptions(
    withOutputStyleOption(withConfiguration(yargs), [
      'dynamic',
      'static',
      'stream',
      'stream-without-prefixes',
      'compact',
    ])
  )
    .parserConfiguration({
      'strip-dashed': true,
      'unknown-options-as-args': true,
      'populate--': true,
    })
    .option('project', {
      describe: 'Target project',
      type: 'string',
    })
    .option('help', {
      describe: 'Show Help',
      type: 'boolean',
    });

  if (executorShouldShowHelp) {
    return res.help(false);
  } else {
    return res.epilog(
      `Run "nx run myapp:mytarget --help" to see information about the executor's schema.`
    );
  }
}

type OptionArgumentDefinition = {
  type: yargs.Options['type'];
  describe?: string;
  default?: any;
  choices?: yargs.Options['type'][];
  demandOption?: boolean;
};

type WorkspaceGeneratorProperties = {
  [name: string]:
    | {
        type: yargs.Options['type'];
        description?: string;
        default?: any;
        enum?: yargs.Options['type'][];
        demandOption?: boolean;
      }
    | {
        type: yargs.PositionalOptionsType;
        description?: string;
        default?: any;
        enum?: yargs.PositionalOptionsType[];
        $default: {
          $source: 'argv';
          index: number;
        };
      };
};

function isPositionalProperty(
  property: WorkspaceGeneratorProperties[keyof WorkspaceGeneratorProperties]
): property is { type: yargs.PositionalOptionsType } {
  return property['$default']?.['$source'] === 'argv';
}

async function withWorkspaceGeneratorOptions(
  yargs: yargs.Argv,
  args: string[]
) {
  // filter out only positional arguments
  args = args.filter((a) => !a.startsWith('-'));
  if (args.length) {
    // this is an actual workspace generator
    return withCustomGeneratorOptions(yargs, args[0]);
  } else {
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
}

async function withCustomGeneratorOptions(
  yargs: yargs.Argv,
  generatorName: string
) {
  const schema = (
    await import('./workspace-generators')
  ).workspaceGeneratorSchema(generatorName);
  const options = [];
  const positionals = [];

  Object.entries(
    (schema.properties ?? {}) as WorkspaceGeneratorProperties
  ).forEach(([name, prop]) => {
    const option: { name: string; definition: OptionArgumentDefinition } = {
      name,
      definition: {
        describe: prop.description,
        type: prop.type,
        default: prop.default,
        choices: prop.enum,
      },
    };
    if (schema.required && schema.required.includes(name)) {
      option.definition.demandOption = true;
    }
    options.push(option);
    if (isPositionalProperty(prop)) {
      positionals.push({
        name,
        definition: {
          describe: prop.description,
          type: prop.type,
          choices: prop.enum,
        },
      });
    }
  });

  let command = generatorName;
  positionals.forEach(({ name }) => {
    command += ` [${name}]`;
  });
  if (options.length) {
    command += ' (options)';
  }

  yargs
    .command({
      // this is the default and only command
      command,
      describe: schema.description || '',
      builder: (y) => {
        options.forEach(({ name, definition }) => {
          y.option(name, definition);
        });
        positionals.forEach(({ name, definition }) => {
          y.positional(name, definition);
        });
        return linkToNxDevAndExamples(y, 'workspace-generator');
      },
      handler: workspaceGeneratorHandler,
    })
    .fail(() => void 0); // no action is needed on failure as Nx will handle it based on schema validation

  return yargs;
}

async function workspaceGeneratorHandler() {
  await (
    await import('./workspace-generators')
  ).workspaceGenerators(process.argv.slice(3));
  process.exit(0);
}

function withMigrationOptions(yargs: yargs.Argv) {
  const defaultCommitPrefix = 'chore: [nx migration] ';

  return yargs
    .positional('packageAndVersion', {
      describe: `The target package and version (e.g, @nrwl/workspace@13.0.0)`,
      type: 'string',
    })
    .option('runMigrations', {
      describe: `Execute migrations from a file (when the file isn't provided, execute migrations from migrations.json)`,
      type: 'string',
    })
    .option('ifExists', {
      describe: `Run migrations only if the migrations file exists, if not continues successfully`,
      type: 'boolean',
      default: false,
    })
    .option('from', {
      describe:
        'Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nrwl/react@12.0.0,@nrwl/js@12.0.0")',
      type: 'string',
    })
    .option('to', {
      describe:
        'Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nrwl/react@12.0.0,@nrwl/js@12.0.0")',
      type: 'string',
    })
    .option('createCommits', {
      describe: 'Automatically create a git commit after each migration runs',
      type: 'boolean',
      alias: ['C'],
      default: false,
    })
    .option('commitPrefix', {
      describe:
        'Commit prefix to apply to the commit for each migration, when --create-commits is enabled',
      type: 'string',
      default: defaultCommitPrefix,
    })
    .option('interactive', {
      describe:
        'Enable prompts to confirm whether to collect optional package updates and migrations',
      type: 'boolean',
      default: false,
    })
    .option('excludeAppliedMigrations', {
      describe:
        'Exclude migrations that should have been applied on previous updates. To be used with --from',
      type: 'boolean',
      default: false,
    })
    .check(
      ({ createCommits, commitPrefix, from, excludeAppliedMigrations }) => {
        if (!createCommits && commitPrefix !== defaultCommitPrefix) {
          throw new Error(
            'Error: Providing a custom commit prefix requires --create-commits to be enabled'
          );
        }
        if (excludeAppliedMigrations && !from) {
          throw new Error(
            'Error: Excluding migrations that should have been previously applied requires --from to be set'
          );
        }
        return true;
      }
    );
}

function withWatchOptions(yargs: yargs.Argv) {
  return yargs
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

function parseCSV(args: string[] | string) {
  if (!args) {
    return args;
  }
  if (Array.isArray(args)) {
    return args;
  }
  return args.split(',');
}

function linkToNxDevAndExamples(yargs: yargs.Argv, command: string) {
  (examples[command] || []).forEach((t) => {
    yargs = yargs.example(t.command, t.description);
  });
  return yargs.epilog(
    chalk.bold(
      `Find more information and examples at https://nx.dev/nx/${command.replace(
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
    runNxSync(`_migrate ${process.argv.slice(3).join(' ')}`, {
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
