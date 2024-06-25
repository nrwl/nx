import { Argv } from 'yargs';

interface ExcludeOptions {
  exclude: string[];
}

export function withExcludeOption(yargs: Argv): Argv<ExcludeOptions> {
  return yargs.option('exclude', {
    describe: 'Exclude certain projects from being processed',
    type: 'string',
    coerce: parseCSV,
  }) as any;
}

export interface RunOptions {
  exclude: string;
  parallel: string;
  maxParallel: number;
  runner: string;
  prod: boolean;
  graph: string;
  verbose: boolean;
  nxBail: boolean;
  nxIgnoreCycles: boolean;
  skipNxCache: boolean;
  cloud: boolean;
  dte: boolean;
  batch: boolean;
  useAgents: boolean;
}

export function withRunOptions<T>(yargs: Argv<T>): Argv<T & RunOptions> {
  return withVerbose(withExcludeOption(yargs))
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
      type: 'string',
      describe:
        'Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal.',
      coerce: (value) =>
        // when the type of an opt is "string", passing `--opt` comes through as having an empty string value.
        // this coercion allows `--graph` to be passed through as a boolean directly, and also normalizes the
        // `--graph=true` to produce the same behaviour as `--graph`.
        value === '' || value === 'true' || value === true
          ? true
          : value === 'false' || value === false
          ? false
          : value,
    })
    .option('nxBail', {
      describe: 'Stop command execution after the first failed task',
      type: 'boolean',
      default: false,
    })
    .option('nxIgnoreCycles', {
      describe: 'Ignore cycles in the task graph',
      type: 'boolean',
      default: false,
    })
    .options('skipNxCache', {
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
    })
    .options('useAgents', {
      type: 'boolean',
      hidden: true,
      alias: 'agents',
    }) as Argv<Omit<RunOptions, 'exclude' | 'batch'>> as any;
}

export function withTargetAndConfigurationOption(
  yargs: Argv,
  demandOption = true
) {
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

export function withConfiguration(yargs: Argv) {
  return yargs.options('configuration', {
    describe:
      'This is the configuration to use when performing tasks on projects',
    type: 'string',
    alias: 'c',
  });
}

export function withVerbose(yargs: Argv) {
  return yargs
    .option('verbose', {
      describe:
        'Prints additional information about the commands (e.g., stack traces)',
      type: 'boolean',
    })
    .middleware((args) => {
      if (args.verbose) {
        process.env.NX_VERBOSE_LOGGING = 'true';
      }
    });
}

export function withBatch(yargs: Argv) {
  return yargs.options('batch', {
    type: 'boolean',
    describe: 'Run task(s) in batches for executors which support batches',
    coerce: (v) => {
      return v || process.env.NX_BATCH_MODE === 'true';
    },
    default: false,
  }) as any;
}

export function withAffectedOptions(yargs: Argv) {
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
    })
    .option('untracked', {
      describe: 'Untracked changes',
      type: 'boolean',
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
      files: ['uncommitted', 'untracked', 'base', 'head'],
      untracked: ['uncommitted', 'files', 'base', 'head'],
      uncommitted: ['files', 'untracked', 'base', 'head'],
    });
}

export interface RunManyOptions extends RunOptions {
  projects: string[];
  /**
   * @deprecated This is deprecated
   */
  all: boolean;
}

export function withRunManyOptions<T>(
  yargs: Argv<T>
): Argv<T & RunManyOptions> {
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
      describe:
        '[deprecated] `run-many` runs all targets on all projects in the workspace if no projects are provided. This option is no longer required.',
      type: 'boolean',
      default: true,
    }) as Argv<T & RunManyOptions>;
}

export function withOverrides<T extends { _: Array<string | number> }>(
  args: T,
  commandLevel: number = 1
): T & { __overrides_unparsed__: string[] } {
  const unparsedArgs: string[] = (args['--'] ?? args._.slice(commandLevel)).map(
    (v) => v.toString()
  );
  delete args['--'];
  delete args._;
  return {
    ...args,
    __overrides_unparsed__: unparsedArgs,
  };
}

const allOutputStyles = [
  'dynamic',
  'static',
  'stream',
  'stream-without-prefixes',
  'compact',
] as const;

export type OutputStyle = (typeof allOutputStyles)[number];

export function withOutputStyleOption(
  yargs: Argv,
  choices: ReadonlyArray<OutputStyle> = [
    'dynamic',
    'static',
    'stream',
    'stream-without-prefixes',
  ]
) {
  return yargs.option('output-style', {
    describe: `Defines how Nx emits outputs tasks logs

| option | description |
| --- | --- |
| dynamic | use dynamic output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended on your local development environments. |
| static | uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. |
| stream | nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr |
| stream-without-prefixes | nx prefixes the project name the target is running on, use this option remove the project name prefix from output |
`,
    type: 'string',
    choices,
  });
}

export function withRunOneOptions(yargs: Argv) {
  const executorShouldShowHelp = !(
    process.argv[2] === 'run' && process.argv[3] === '--help'
  );

  const res = withRunOptions(
    withOutputStyleOption(withConfiguration(yargs), allOutputStyles)
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

export function parseCSV(args: string[] | string): string[] {
  if (!args) {
    return [];
  }
  if (Array.isArray(args)) {
    // If parseCSV is used on `type: 'array'`, the first option may be something like ['a,b,c'].
    return args.length === 1 && args[0].includes(',')
      ? parseCSV(args[0])
      : args;
  }
  const items = args.split(',');
  return items.map((i) =>
    i.startsWith('"') && i.endsWith('"') ? i.slice(1, -1) : i
  );
}
