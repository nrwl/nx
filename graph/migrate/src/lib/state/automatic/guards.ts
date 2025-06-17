import { AutomaticMigrationState } from './types';
import {
  currentMigrationCanLeaveReview,
  currentMigrationHasChanges,
  currentMigrationHasFailed,
  currentMigrationHasSucceeded,
  currentMigrationIsSkipped,
  currentMigrationIsRunning,
} from './selectors';

export const guards = {
  canStartRunningCurrentMigration: (ctx: AutomaticMigrationState) => {
    return (
      !!ctx.currentMigration &&
      !currentMigrationIsRunning(ctx) &&
      !currentMigrationIsSkipped(ctx) &&
      // Allow running if migration is not completed
      // stopped migrations can be restarted via the UI, Nx-console will handle the state change
      !currentMigrationHasFailed(ctx) &&
      !currentMigrationHasChanges(ctx)
    );
  },

  currentMigrationIsDone: (ctx: AutomaticMigrationState) => {
    return (
      !!ctx.currentMigration &&
      !currentMigrationIsRunning(ctx) &&
      ((currentMigrationHasSucceeded(ctx) &&
        currentMigrationCanLeaveReview(ctx)) ||
        currentMigrationIsSkipped(ctx))
    );
  },

  currentMigrationCanLeaveReview: (ctx: AutomaticMigrationState) =>
    currentMigrationCanLeaveReview(ctx),

  lastMigrationIsDone: (ctx: AutomaticMigrationState) => {
    if (!ctx.migrations || !ctx.currentMigration) return false;

    const currentIndex = ctx.migrations.findIndex(
      (m) => m.id === ctx.currentMigration?.id
    );

    return (
      currentIndex === ctx.migrations.length - 1 &&
      currentMigrationCanLeaveReview(ctx)
    );
  },

  needsReview: (ctx: AutomaticMigrationState) => {
    return (
      !currentMigrationIsRunning(ctx) &&
      !guards.canStartRunningCurrentMigration(ctx)
    );
  },
};
