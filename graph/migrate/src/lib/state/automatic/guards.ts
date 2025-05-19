import { AutomaticMigrationState } from './types';
import {
  currentMigrationCanLeaveReview,
  currentMigrationHasChanges,
  currentMigrationHasFailed,
  currentMigrationIsSkipped,
} from './selectors';

export const guards = {
  canStartRunningCurrentMigration: (ctx: AutomaticMigrationState) => {
    return (
      !!ctx.currentMigration &&
      !ctx.currentMigrationRunning &&
      ((!currentMigrationHasFailed(ctx) && !currentMigrationHasChanges(ctx)) ||
        currentMigrationIsSkipped(ctx))
    );
  },
  currentMigrationIsDone: (ctx: AutomaticMigrationState) => {
    if (!ctx.currentMigration) {
      return false;
    }

    return (
      !!ctx.currentMigration &&
      !ctx.currentMigrationRunning &&
      currentMigrationCanLeaveReview(ctx)
    );
  },
  currentMigrationCanLeaveReview: (ctx: AutomaticMigrationState) =>
    currentMigrationCanLeaveReview(ctx),
  lastMigrationIsDone: (ctx: AutomaticMigrationState) => {
    if (!ctx.migrations) {
      return false;
    }
    const currentMigrationIndex = ctx.migrations.findIndex(
      (migration) => migration.id === ctx.currentMigration?.id
    );
    return (
      currentMigrationIndex === ctx.migrations.length - 1 &&
      currentMigrationCanLeaveReview(ctx)
    );
  },
  needsReview: (ctx: AutomaticMigrationState) => {
    return (
      !ctx.currentMigrationRunning &&
      !guards.canStartRunningCurrentMigration(ctx)
    );
  },
};
