import { handleErrors } from '../utils/params';
import * as migrationsJson from '../../migrations.json';
import { executeMigrations } from './migrate';
import { output } from '../utils/output';

export async function repair(
  args: { verbose: boolean },
  extraMigrations = [] as any[]
) {
  return handleErrors(args['verbose'], async () => {
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
      args['verbose'],
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
