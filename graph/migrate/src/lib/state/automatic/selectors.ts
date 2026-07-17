// nx-ignore-next-line
import { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';

import type { AutomaticMigrationState } from './types';
import { isHybridShape, MigrationsJsonMetadata } from '../../migration-shape';

export function findFirstIncompleteMigration(
  migrations: MigrationDetailsWithId[],
  nxConsoleMetadata: MigrationsJsonMetadata
) {
  return (
    migrations.find((migration) => {
      const data = nxConsoleMetadata.completedMigrations?.[migration.id];
      if (!data) return true;
      if (data.type === 'skipped') return false;
      if (data.type === 'successful') {
        // Hybrid migrations still need the user's AI-prompt acknowledgement
        // before they count as complete — otherwise a session reopened after
        // generator success would skip past them and the prompt would never
        // be acked.
        return isHybridShape(migration) && !data.acknowledgedPrompt;
      }
      return true;
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
  if (type === 'skipped') return true;
  // Metadata-recorded success is the gate — the local `reviewedMigrations`
  // flag is a precondition for hybrid-with-changes, never a substitute. This
  // prevents the prompt-only/hybrid-no-changes race where the user clicks
  // Mark as Run, the reviewed flag is set synchronously, and the machine
  // advances to `done` before the backend has written the successful entry.
  if (type !== 'successful') return false;
  // Hybrid migrations need the user's AI-prompt acknowledgement before they
  // can leave review — even if the generator produced no diff.
  if (ctx.currentMigration && isHybridShape(ctx.currentMigration)) {
    const data = getCurrentMigrationCompletedData(ctx);
    if (data?.type === 'successful' && !data.acknowledgedPrompt) return false;
  }
  return !currentMigrationHasChanges(ctx) || currentMigrationIsReviewed(ctx);
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
