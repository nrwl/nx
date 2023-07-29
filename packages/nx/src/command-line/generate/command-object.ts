import { CommandModule, Argv } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';

export const yargsGenerateCommand: CommandModule = {
  command: 'generate <generator> [_..]',
  describe:
    'Generate or update source code (e.g., nx generate @nx/js:lib mylib).',
  aliases: ['g'],
  builder: (yargs) => withGenerateOptions(yargs),
  handler: async (args) => {
    // Remove the command from the args
    args._ = args._.slice(1);

    process.exit(
      await (await import('./generate')).generate(process.cwd(), args)
    );
  },
};

/**
 * @deprecated(v17): Remove `workspace-generator in v17. Use local plugins.
 */
export const yargsWorkspaceGeneratorCommand: CommandModule = {
  command: 'workspace-generator [generator]',
  describe: 'Runs a workspace generator from the tools/generators directory',
  deprecated:
    'Use a local plugin instead. See: https://nx.dev/deprecated/workspace-generators',
  aliases: ['workspace-schematic [schematic]'],
  builder: async (yargs) =>
    linkToNxDevAndExamples(withGenerateOptions(yargs), 'workspace-generator'),
  handler: async (args) => {
    await (await import('./generate')).workspaceGenerators(args);
    process.exit(0);
  },
};

function withGenerateOptions(yargs: Argv) {
  const generatorWillShowHelp =
    process.argv[3] && !process.argv[3].startsWith('-');
  const res = yargs
    .positional('generator', {
      describe: 'Name of the generator (e.g., @nx/js:library, library)',
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
