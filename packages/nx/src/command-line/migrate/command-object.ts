import { Argv, CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withVerbose } from '../yargs-utils/shared-options';
import { AGENT_IDS, coerceAgenticArg } from './agentic/cli-args';

export const yargsMigrateCommand: CommandModule = {
  command: 'migrate [packageAndVersion]',
  describe: `Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.`,
  builder: (yargs) =>
    linkToNxDevAndExamples(withMigrationOptions(yargs), 'migrate'),
  handler: async () =>
    process.exit(
      await (await handleImport('./migrate.js', __dirname)).runMigration()
    ),
};

export const yargsInternalMigrateCommand: CommandModule = {
  command: '_migrate [packageAndVersion]',
  describe: false,
  builder: (yargs) => withMigrationOptions(yargs),
  handler: async (args) =>
    process.exit(
      await (
        await handleImport('./migrate.js', __dirname)
      ).migrate(process.cwd(), args, process.argv.slice(3))
    ),
};

export const DEFAULT_MIGRATION_COMMIT_PREFIX = 'chore: [nx migration] ';

function withMigrationOptions(yargs: Argv) {
  return withVerbose(yargs)
    .positional('packageAndVersion', {
      describe: `The target package and version (e.g, @nx/workspace@16.0.0).`,
      type: 'string',
    })
    .option('runMigrations', {
      describe: `Execute migrations from a file (when the file isn't provided, execute migrations from migrations.json).`,
      type: 'string',
    })
    .option('ifExists', {
      describe: `Run migrations only if the migrations file exists, if not continues successfully.`,
      type: 'boolean',
      default: false,
    })
    .option('from', {
      describe:
        'Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nx/react@16.0.0,@nx/js@16.0.0").',
      type: 'string',
    })
    .option('to', {
      describe:
        'Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nx/react@16.0.0,@nx/js@16.0.0").',
      type: 'string',
    })
    .option('createCommits', {
      describe: 'Automatically create a git commit after each migration runs.',
      type: 'boolean',
      alias: ['C'],
    })
    .option('commitPrefix', {
      describe:
        'Commit prefix to apply to the commit for each migration, when --create-commits is enabled.',
      type: 'string',
      default: DEFAULT_MIGRATION_COMMIT_PREFIX,
    })
    .option('interactive', {
      describe:
        'Enable prompts to confirm whether to collect optional package updates and migrations.',
      type: 'boolean',
    })
    .option('excludeAppliedMigrations', {
      describe:
        'Exclude migrations that should have been applied on previous updates. To be used with --from.',
      type: 'boolean',
      default: false,
    })
    .option('skipInstall', {
      describe:
        'Skip installing packages before running migrations. Useful when the installation needs to be performed manually (e.g., to resolve peer dependency conflicts).',
      type: 'boolean',
      default: false,
    })
    .option('mode', {
      describe:
        "Restrict which packages to migrate. Only applies when migrating Nx itself. 'first-party' processes only Nx and its plugins (the target package plus its nx.packageGroup); 'third-party' processes only the third-party dependencies referenced by Nx packageJsonUpdates entries, catching up on any updates that may have been skipped previously; 'all' processes everything. When targeting Nx in an interactive terminal, prompts for the value if not provided; otherwise defaults to 'all'.",
      type: 'string',
      choices: ['first-party', 'third-party', 'all'],
    })
    .option('multiMajorMode', {
      describe:
        "Skip the multi-major migration prompt/warning and pick how to handle the jump. 'direct' migrates straight to the requested target. 'gradual' migrates to the smallest recommended step (re-run `nx migrate` to continue toward the original target). Equivalent env var: NX_MULTI_MAJOR_MODE=direct|gradual.",
      type: 'string',
      choices: ['direct', 'gradual'],
    })
    .option('agentic', {
      describe:
        'Enable the agentic flow for prompt-based migrations and AI-driven review. Pass `--agentic=<agent>` to pin a specific agent (claude-code, codex, or opencode). Pass `--agentic=false` or `--no-agentic` to disable.',
      coerce: coerceAgenticArg,
    })
    .option('validate', {
      describe:
        'When `--agentic` resolves to an enabled agent, run agent-driven validation after generator-only migrations that have no `prompt:` field. Defaults to on; pass `--no-validate` to opt out. Has no effect when `--agentic` is disabled, when running inside an outer agent, or when running non-interactively without an explicit agent.',
      type: 'boolean',
    })
    .check(
      ({
        createCommits,
        commitPrefix,
        from,
        excludeAppliedMigrations,
        mode,
        agentic,
      }) => {
        const agenticMayEnableCommits =
          agentic !== undefined && agentic !== false && createCommits !== false;
        if (
          createCommits !== true &&
          !agenticMayEnableCommits &&
          commitPrefix !== DEFAULT_MIGRATION_COMMIT_PREFIX
        ) {
          throw new Error(
            'Error: Providing a custom commit prefix requires --create-commits to be enabled'
          );
        }
        if (excludeAppliedMigrations && !from && mode !== 'third-party') {
          throw new Error(
            'Error: Excluding migrations that should have been previously applied requires --from to be set'
          );
        }
        if (
          typeof agentic === 'string' &&
          !(AGENT_IDS as readonly string[]).includes(agentic)
        ) {
          throw new Error(
            `Error: Invalid --agentic value "${agentic}". Allowed: ${AGENT_IDS.join(
              ', '
            )}, true, false.`
          );
        }
        return true;
      }
    );
}
