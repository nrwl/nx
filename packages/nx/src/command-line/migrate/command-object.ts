import { Argv, CommandModule } from 'yargs';
import * as path from 'path';
import { runNxSync } from '../../utils/child-process';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { execSync } from 'child_process';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { writeJsonFile } from '../../utils/fileutils';
import { workspaceRoot } from '../../utils/workspace-root';

export const yargsMigrateCommand: CommandModule = {
  command: 'migrate [packageAndVersion]',
  describe: `Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.`,
  builder: (yargs) =>
    linkToNxDevAndExamples(withMigrationOptions(yargs), 'migrate'),
  handler: () => {
    runMigration();
    process.exit(0);
  },
};

export const yargsInternalMigrateCommand: CommandModule = {
  command: '_migrate [packageAndVersion]',
  describe: false,
  builder: (yargs) => withMigrationOptions(yargs),
  handler: async (args) =>
    process.exit(
      await (
        await import('./migrate')
      ).migrate(process.cwd(), args, process.argv.slice(3))
    ),
};

function withMigrationOptions(yargs: Argv) {
  const defaultCommitPrefix = 'chore: [nx migration] ';

  return yargs
    .positional('packageAndVersion', {
      describe: `The target package and version (e.g, @nx/workspace@16.0.0)`,
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
        'Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nx/react@16.0.0,@nx/js@16.0.0")',
      type: 'string',
    })
    .option('to', {
      describe:
        'Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nx/react@16.0.0,@nx/js@16.0.0")',
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
