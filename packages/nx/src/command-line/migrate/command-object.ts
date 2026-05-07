import { Argv, CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withVerbose } from '../yargs-utils/shared-options';

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

function withMigrationOptions(yargs: Argv) {
  const defaultCommitPrefix = 'chore: [nx migration] ';

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
      default: false,
    })
    .option('commitPrefix', {
      describe:
        'Commit prefix to apply to the commit for each migration, when --create-commits is enabled.',
      type: 'string',
      default: defaultCommitPrefix,
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
        "Restrict which packages to migrate. Only applies when migrating Nx itself. 'first-party' processes only Nx and its plugins (the target package plus its nx.packageGroup); 'third-party' processes only the third-party dependencies referenced by Nx packageJsonUpdates entries, catching up on any updates that may have been skipped previously; 'all' processes everything. Defaults to 'all' (or prompts in an interactive terminal when targeting Nx).",
      type: 'string',
      choices: ['first-party', 'third-party', 'all'],
    })
    .option('acceptMultiMajorUpdate', {
      describe:
        'Skip the multi-major migration prompt/warning and migrate directly to the target version even when it crosses more than one major boundary. The recommended process is to update one major version at a time. Equivalent env var: NX_ACCEPT_MULTI_MAJOR_UPDATE=true.',
      type: 'boolean',
      default: false,
    })
    .check(
      ({
        createCommits,
        commitPrefix,
        from,
        excludeAppliedMigrations,
        mode,
      }) => {
        if (!createCommits && commitPrefix !== defaultCommitPrefix) {
          throw new Error(
            'Error: Providing a custom commit prefix requires --create-commits to be enabled'
          );
        }
        if (excludeAppliedMigrations && !from && mode !== 'third-party') {
          throw new Error(
            'Error: Excluding migrations that should have been previously applied requires --from to be set'
          );
        }
        return true;
      }
    );
}
