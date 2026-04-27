// nx-ignore-next-line
import { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
// nx-ignore-next-line
import { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';

export type AutomaticMigrationState = {
  migrations?: MigrationDetailsWithId[];
  nxConsoleMetadata?: MigrationsJsonMetadata;
  currentMigration?: MigrationDetailsWithId;
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
      type: 'stop';
    }
  | {
      type: 'startRunning';
    }
  | {
      type: 'reviewMigration';
      migrationId: string;
    };
