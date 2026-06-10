import { AutomaticMigrationState } from './types';
import {
  getCurrentMigrationType,
  currentMigrationCanLeaveReview,
  currentMigrationHasChanges,
  currentMigrationIsRunning,
} from './selectors';
import { isPromptOnlyShape } from '../../migration-shape';

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
      // An already-successful entry should never re-spawn the generator —
      // it falls to needsReview instead (where the user acks for hybrid or
      // the machine increments past for regular).
      !(type === 'successful') &&
      !currentMigrationHasChanges(ctx) &&
      // Nx Console can't run AI prompts — prompt-only migrations require the
      // user to explicitly Approve once they've run the prompt externally.
      !isPromptOnlyShape(ctx.currentMigration)
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
