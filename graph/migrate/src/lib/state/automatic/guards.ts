import { AutomaticMigrationState } from './types';
import {
  getCurrentMigrationType,
  currentMigrationCanLeaveReview,
  currentMigrationHasChanges,
  currentMigrationIsRunning,
} from './selectors';

export const guards = {
  canStartRunningCurrentMigration: (ctx: AutomaticMigrationState) => {
    const type = getCurrentMigrationType(ctx);
    return (
      !!ctx.currentMigration &&
      !currentMigrationIsRunning(ctx) &&
      !(type === 'skipped') &&
      // Allow running if migration is not completed
      // stopped migrations can be restarted via the UI, Nx-console will handle the state change
      !(type === 'failed') &&
      !currentMigrationHasChanges(ctx)
    );
  },

  currentMigrationIsDone: (ctx: AutomaticMigrationState) => {
    const type = getCurrentMigrationType(ctx);
    return (
      !!ctx.currentMigration &&
      !currentMigrationIsRunning(ctx) &&
      ((type === 'successful' && currentMigrationCanLeaveReview(ctx)) ||
        type === 'skipped')
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
