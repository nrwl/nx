/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */

import { createMachine, send } from 'xstate';
import { assign } from '@xstate/immer';
import { log } from 'xstate/lib/actions';

type AutomaticMigrationState = {
  migrations?: MigrationDetailsWithId[];
  nxConsoleMetadata?: MigrationsJsonMetadata;
  currentMigration?: MigrationDetailsWithId;
  currentMigrationRunning?: boolean;
  reviewedMigrations: string[];
};

type AutomaticMigrationEvents =
  | {
      type: 'loadInitialData';
      migrations: MigrationDetailsWithId[];
      metadata: MigrationsJsonMetadata;
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
    };

const guards = {
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
    const completedMigration =
      ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration.id];

    console.log(
      'currentMigrationIsDone?',
      !!ctx.currentMigration &&
        !ctx.currentMigrationRunning &&
        ((completedMigration?.type === 'successful' &&
          completedMigration.changedFiles.length === 0) ||
          currentMigrationIsSkipped(ctx) ||
          currentMigrationIsReviewed(ctx))
    );

    return (
      !!ctx.currentMigration &&
      !ctx.currentMigrationRunning &&
      ((completedMigration?.type === 'successful' &&
        completedMigration.changedFiles.length === 0) ||
        currentMigrationIsSkipped(ctx) ||
        currentMigrationIsReviewed(ctx))
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
    console.log('evaluating needs review');
    return (
      !ctx.currentMigrationRunning &&
      !guards.canStartRunningCurrentMigration(ctx)
    );
  },
};
export const automaticMigrationMachine = createMachine<
  AutomaticMigrationState,
  AutomaticMigrationEvents
>(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QFsCWUBOBDALmAxADYD2WEAkgHao6paEAiuWA2gAwC6ioADsbDVTFK3EAA9EbAHQAmAIwAOBXLkB2AJyqALADYtbLTIA0IAJ6IdO9VJ0GAzGx0yZOgKwGAvh5NpMuAgCuPBD+ALJgOGTM7FxIIHwCtMKiEgiKOlJauuqu6mzqCqquyibmCG4ZMppsMmxsdupy6k5ePujYeFI8WAGwkPiwkRg4AEoBlNSUUDGiCYLJcalyupmqVa6ubjLKdtqliHIyNgquLpZshzraWnatIL4dYFIY45NQ+N29YDNxc0kiiwOqjkUk2qjsWjUkMsy32aQUdlkWRceS06js2wxdwe-mer1QU3wP14-HmANAqWKINUOgUVS0SkU+nUcO0oI0lgxllcWTU2PauJeEwJ7xYcliJMSQnJ4kQm0R8kMtg2+RkuzhyxBclcTVcawMbFcENU-L8nSFbyJMgl8VJ-xScrsiMMevUMlUbGBemMZkQLkRbo2BQ2Gl0rlNjzxwsJLDsNr+0odCFy1jq2jkTlpCNUCjhLqk6kLymKVXyWhpEdxlDAkFgIzAADdUGAAO4fHp9Ym2qULCmIAC0y1BhuUarUPIUzVccIcCikRScwLYk6KDRN3nuAs61dr9abraJnFmdsTgIQ7qOwPcziyy9pPrK+mk6Lccgh2rkBgUOi8G8oxAgOBRBxPBjx7GVUn7JxhypMcigZKc4X7NkdF2Nx8mKBDNErTpPj6CAwLJJN+2sKwXCURdilpcs4TdKQMTsJwZB1eoaTpHCngtEVCPtM9GMqZQ6TdHQVEMAxWTnL9tTydQshzdEOKkHcIDrRtmxbHjTz7BA7CaKRs3cXZCyqSw4UM0E1TyXTyLsBQtEUiBhDATTe1lBAdn01RgWcK4GiyLQ8znYp6i0TZJ3cE51F-DwgA */
    predictableActionArguments: true,
    preserveActionOrder: true,
    id: 'migrate',
    initial: 'paused',
    context: {
      reviewedMigrations: [],
    },
    states: {
      paused: {
        on: {
          startRunning: [
            {
              target: 'running',
            },
          ],
        },
      },
      running: {
        entry: [log('running')],
        on: {
          pause: [
            {
              target: 'paused',
            },
          ],
        },
        always: [
          {
            cond: 'lastMigrationIsDone',
            target: 'done',
          },
          {
            cond: 'currentMigrationIsDone',
            target: 'running',
            actions: ['incrementCurrentMigration'],
          },
          {
            cond: 'canStartRunningCurrentMigration',
            actions: ['setCurrentMigrationRunning', 'runMigration'],
          },
          {
            target: 'needsReview',
            cond: 'needsReview',
          },
        ],
      },
      needsReview: {
        on: {
          pause: [
            {
              target: 'paused',
            },
          ],
        },
        always: [
          {
            cond: 'currentMigrationCanLeaveReview',
            target: 'running',
          },
        ],
      },
      done: {
        entry: [log('done')],
      },
    },
    on: {
      loadInitialData: [
        {
          actions: [
            assign((ctx, event) => {
              ctx.migrations = event.migrations;
              ctx.nxConsoleMetadata = event.metadata;
              ctx.currentMigration = findFirstIncompleteMigration(
                event.migrations,
                event.metadata
              );
            }),
          ],
        },
      ],
      updateMetadata: [
        {
          actions: [
            log('updating metadata'),
            assign((ctx, event) => {
              console.log('metadata', event.metadata);
              ctx.nxConsoleMetadata = event.metadata;

              if (
                ctx.currentMigration &&
                ctx.nxConsoleMetadata.completedMigrations?.[
                  ctx.currentMigration.id
                ]
              ) {
                ctx.currentMigrationRunning = false;
              }
            }),
          ],
        },
      ],
    },
  },
  {
    guards,
    actions: {
      incrementCurrentMigration: assign((ctx) => {
        if (!ctx.migrations) {
          return;
        }
        const currentMigrationIndex = ctx.migrations?.findIndex(
          (migration) => migration.id === ctx.currentMigration?.id
        );
        if (
          currentMigrationIndex === undefined ||
          currentMigrationIndex === ctx.migrations.length - 1
        ) {
          return;
        }
        ctx.currentMigration = ctx.migrations?.[currentMigrationIndex + 1];
      }),
      setCurrentMigrationRunning: assign((ctx) => {
        ctx.currentMigrationRunning = true;
      }),
    },
  }
);

function currentMigrationHasFailed(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  const completedMigration =
    ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration.id];
  return completedMigration?.type === 'failed';
}

function currentMigrationHasSucceeded(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  const completedMigration =
    ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration.id];
  return completedMigration?.type === 'successful';
}

function currentMigrationHasChanges(ctx: AutomaticMigrationState) {
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

function currentMigrationIsSkipped(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  const completedMigration =
    ctx.nxConsoleMetadata?.completedMigrations?.[ctx.currentMigration.id];
  return completedMigration?.type === 'skipped';
}

function currentMigrationIsReviewed(ctx: AutomaticMigrationState) {
  if (!ctx.currentMigration) {
    return false;
  }
  return ctx.reviewedMigrations.includes(ctx.currentMigration.id);
}

function currentMigrationCanLeaveReview(ctx: AutomaticMigrationState) {
  return (
    currentMigrationIsReviewed(ctx) ||
    currentMigrationIsSkipped(ctx) ||
    currentMigrationHasSucceeded(ctx)
  );
}

// this is where the ui should start off on
// we assume completed migrations in the past are reviewed
function findFirstIncompleteMigration(
  migrations: MigrationDetailsWithId[],
  nxConsoleMetadata: MigrationsJsonMetadata
) {
  return (
    migrations.find(
      (migration) =>
        nxConsoleMetadata.completedMigrations?.[migration.id]?.type !==
        'successful'
    ) ?? migrations[0]
  );
}
