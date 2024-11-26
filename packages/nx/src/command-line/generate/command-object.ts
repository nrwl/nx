import { CommandModule, Argv } from 'yargs';
import { getCwd } from '../../utils/path';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withVerbose } from '../yargs-utils/shared-options';

export const yargsGenerateCommand: CommandModule = {
  command: 'generate <generator> [_..]',
  describe:
    'Generate or update source code (e.g., nx generate @nx/js:lib mylib).',
  aliases: ['g'],
  builder: (yargs) => withGenerateOptions(yargs),
  handler: async (args) => {
    // Remove the command from the args
    args._ = args._.slice(1);

    process.exit(await (await import('./generate')).generate(getCwd(), args));
  },
};

function withGenerateOptions(yargs: Argv) {
  const generatorWillShowHelp =
    process.argv[3] && !process.argv[3].startsWith('-');
  const res = withVerbose(yargs)
    .positional('generator', {
      describe: 'Name of the generator (e.g., @nx/js:library, library).',
      type: 'string',
      required: true,
    })
    .option('dryRun', {
      describe: 'Preview the changes without updating files.',
      alias: 'd',
      type: 'boolean',
      default: false,
    })
    .option('interactive', {
      describe: 'When false disables interactive input prompts for options.',
      type: 'boolean',
      default: true,
    })
    .option('quiet', {
      describe: 'Hides logs from tree operations (e.g. `CREATE package.json`).',
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
