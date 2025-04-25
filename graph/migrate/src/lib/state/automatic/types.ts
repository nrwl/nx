/* eslint-disable @nx/enforce-module-boundaries */
import { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
import { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */

export type AutomaticMigrationState = {
  migrations?: MigrationDetailsWithId[];
  nxConsoleMetadata?: MigrationsJsonMetadata;
  currentMigration?: MigrationDetailsWithId;
  currentMigrationRunning?: boolean;
  reviewedMigrations: string[];
};

export type AutomaticMigrationEvents =
  | {
      type: 'loadInitialData';
      migrations: MigrationDetailsWithId[];
      metadata: MigrationsJsonMetadata;
      currentMigrationId?: string;
    }
  | {
      type: 'updateMetadata';
      metadata: MigrationsJsonMetadata;
    }
  | {
      type: 'pause';
    }
  | {
      type: 'startRunning';
    }
  | {
      type: 'reviewMigration';
      migrationId: string;
    };
