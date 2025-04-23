/* eslint-disable @nx/enforce-module-boundaries */
import { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
import { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import type { AutomaticMigrationState } from './types';

// this is where the ui should start off on
// we assume completed migrations in the past are reviewed
export function findFirstIncompleteMigration(
  migrations: MigrationDetailsWithId[],
  nxConsoleMetadata: MigrationsJsonMetadata
) {
  return (
    migrations.find(
      (migration) =>
        nxConsoleMetadata.completedMigrations?.[migration.id]?.type !==
          'successful' &&
        nxConsoleMetadata.completedMigrations?.[migration.id]?.type !==
          'skipped'
    ) ?? migrations[0]
  );
}

export function currentMigrationHasSucceeded(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  const completedMigration =
    ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration.id];
  return completedMigration?.type === 'successful';
}

export function currentMigrationHasChanges(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  const completedMigration =
    ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration.id];
  return (
    completedMigration?.type === 'successful' &&
    completedMigration.changedFiles.length > 0
  );
}

export function currentMigrationIsSkipped(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  const completedMigration =
    ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration.id];
  return completedMigration?.type === 'skipped';
}

export function currentMigrationIsReviewed(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  return ctx.reviewedMigrations.includes(ctx.currentMigration.id);
}

export function currentMigrationCanLeaveReview(ctx: AutomaticMigrationState) {
  return (
    currentMigrationIsReviewed(ctx) ||
    currentMigrationIsSkipped(ctx) ||
    (currentMigrationHasSucceeded(ctx) && !currentMigrationHasChanges(ctx))
  );
}

export function currentMigrationHasFailed(
  ctx: AutomaticMigrationState
): boolean {
  if (!ctx.currentMigration) {
    return false;
  }
  const completedMigration =
    ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration.id];
  return completedMigration?.type === 'failed';
}
