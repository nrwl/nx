import { handleErrors } from '../../utils/params';
import * as migrationsJson from '../../../migrations.json';
import { executeMigrations } from '../migrate/migrate';
import { output } from '../../utils/output';

export async function repair(
  args: { verbose: boolean },
  extraMigrations = [] as any[]
) {
  if (args['verbose']) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const verbose = process.env.NX_VERBOSE_LOGGING === 'true';
  return handleErrors(verbose, async () => {
    const nxMigrations = Object.entries(migrationsJson.generators).map(
      ([name, migration]) => {
        return {
          package: 'nx',
          cli: 'nx',
          name,
          description: migration.description,
          version: migration.version,
        } as const;
      }
    );

    const migrations = [...nxMigrations, ...extraMigrations];
    const migrationsThatMadeNoChanges = await executeMigrations(
      process.cwd(),
      migrations,
      verbose,
      false,
      ''
    );

    if (migrationsThatMadeNoChanges.length < migrations.length) {
      output.success({
        title: `Successfully repaired your configuration. This workspace is up to date!`,
      });
    } else {
      output.success({
        title: `No changes were necessary. This workspace is up to date!`,
      });
    }
  });
}
