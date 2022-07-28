import { logger } from '../utils/logger';
import { handleErrors } from '../utils/params';
import * as migrationsJson from '../../migrations.json';
import { executeMigrations } from './migrate';

export async function repair(args: { verbose: boolean }) {
  return handleErrors(args['verbose'], async () => {
    const migrations = Object.entries(migrationsJson.generators).map(
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
    const migrationsThatMadeNoChanges = await executeMigrations(
      process.cwd(),
      migrations,
      args['verbose'],
      false,
      ''
    );

    if (migrationsThatMadeNoChanges.length < migrations.length) {
      logger.info(
        `NX Successfully repaired your configuration. This workspace is up to date!`
      );
    } else {
      logger.info(
        `NX No changes were necessary. This workspace is up to date!`
      );
    }
  });
}
