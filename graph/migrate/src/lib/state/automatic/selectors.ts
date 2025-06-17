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

export function currentMigrationHasSucceeded(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  return isMigrationSuccessful(ctx, ctx.currentMigration.id);
}

export function currentMigrationHasChanges(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  const completed =
    ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration?.id];
  return (
    completed?.type === 'successful' &&
    (completed.changedFiles?.length ?? 0) > 0
  );
}

export function isMigrationSuccessful(
  ctx: AutomaticMigrationState,
  migrationId: string
) {
  return (
    ctx.nxConsoleMetadata?.completedMigrations?.[migrationId]?.type ===
    'successful'
  );
}

export function isMigrationFailed(
  ctx: AutomaticMigrationState,
  migrationId: string
) {
  return (
    ctx.nxConsoleMetadata?.completedMigrations?.[migrationId]?.type === 'failed'
  );
}

export function isMigrationSkipped(
  ctx: AutomaticMigrationState,
  migrationId: string
) {
  return (
    ctx.nxConsoleMetadata?.completedMigrations?.[migrationId]?.type ===
    'skipped'
  );
}

export function isMigrationStopped(
  ctx: AutomaticMigrationState,
  migrationId: string
) {
  return (
    ctx.nxConsoleMetadata?.completedMigrations?.[migrationId]?.type ===
    'stopped'
  );
}

export function currentMigrationIsSkipped(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  return isMigrationSkipped(ctx, ctx.currentMigration.id);
}

export function currentMigrationHasFailed(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  return isMigrationFailed(ctx, ctx.currentMigration.id);
}

export function currentMigrationIsStopped(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  return isMigrationStopped(ctx, ctx.currentMigration.id);
}

export function currentMigrationIsReviewed(ctx: AutomaticMigrationState) {
  return (
    !!ctx.currentMigration &&
    ctx.reviewedMigrations.includes(ctx.currentMigration.id)
  );
}

export function currentMigrationCanLeaveReview(ctx: AutomaticMigrationState) {
  return (
    currentMigrationIsReviewed(ctx) ||
    currentMigrationIsSkipped(ctx) ||
    (currentMigrationHasSucceeded(ctx) && !currentMigrationHasChanges(ctx))
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
  if (!ctx.currentMigration) {
    return false;
  }
  return isMigrationRunning(ctx, ctx.currentMigration.id);
}
