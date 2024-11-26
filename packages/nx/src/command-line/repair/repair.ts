import { handleErrors } from '../../utils/handle-errors';
import * as migrationsJson from '../../../migrations.json';
import { executeMigrations } from '../migrate/migrate';
import { output } from '../../utils/output';

export async function repair(
  args: { verbose: boolean },
  extraMigrations = [] as any[]
) {
  return handleErrors(args.verbose, async () => {
    const nxMigrations = Object.entries(migrationsJson.generators).reduce(
      (agg, [name, migration]) => {
        const skip = migration['x-repair-skip'];
        if (!skip) {
          agg.push({
            package: 'nx',
            cli: 'nx',
            name,
            description: migration.description,
            version: migration.version,
          } as const);
        }
        return agg;
      },
      []
    );

    const migrations = [...nxMigrations, ...extraMigrations];
    const migrationsThatMadeNoChanges = await executeMigrations(
      process.cwd(),
      migrations,
      args.verbose,
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
