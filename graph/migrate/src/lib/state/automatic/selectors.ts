/* eslint-disable @nx/enforce-module-boundaries */
import { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
import { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import type { AutomaticMigrationState } from './types';

export function findFirstIncompleteMigration(
  migrations: MigrationDetailsWithId[],
  nxConsoleMetadata: MigrationsJsonMetadata
) {
  return (
    migrations.find((migration) => {
      const type = nxConsoleMetadata.completedMigrations?.[migration.id]?.type;
      return type !== 'successful' && type !== 'skipped';
    }) ?? migrations[0]
  );
}

export function getMigrationType(
  ctx: AutomaticMigrationState,
  migrationId: string
) {
  return ctx.nxConsoleMetadata?.completedMigrations?.[migrationId]?.type;
}

export function getCurrentMigrationType(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) return undefined;
  return getMigrationType(ctx, ctx.currentMigration.id);
}

export function getMigrationCompletedData(
  ctx: AutomaticMigrationState,
  migrationId: string
) {
  return ctx.nxConsoleMetadata?.completedMigrations?.[migrationId];
}

export function getCurrentMigrationCompletedData(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) return undefined;
  return getMigrationCompletedData(ctx, ctx.currentMigration.id);
}

export function currentMigrationHasChanges(ctx: AutomaticMigrationState) {
  const completed = getCurrentMigrationCompletedData(ctx);
  return (
    completed?.type === 'successful' &&
    (completed.changedFiles?.length ?? 0) > 0
  );
}

export function currentMigrationIsReviewed(ctx: AutomaticMigrationState) {
  return (
    !!ctx.currentMigration &&
    ctx.reviewedMigrations.includes(ctx.currentMigration.id)
  );
}

export function currentMigrationCanLeaveReview(ctx: AutomaticMigrationState) {
  const type = getCurrentMigrationType(ctx);
  return (
    currentMigrationIsReviewed(ctx) ||
    type === 'skipped' ||
    (type === 'successful' && !currentMigrationHasChanges(ctx))
  );
}

export function isMigrationRunning(
  ctx: AutomaticMigrationState,
  migrationId: string
) {
  return (
    ctx.nxConsoleMetadata?.runningMigrations?.includes(migrationId) ?? false
  );
}

export function currentMigrationIsRunning(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) return false;
  return isMigrationRunning(ctx, ctx.currentMigration.id);
}
