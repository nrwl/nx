import { assign } from '@xstate/immer';
import { createMachine } from 'xstate';
import { guards } from './guards';
import type {
  AutomaticMigrationEvents,
  AutomaticMigrationState,
} from './types';
import { findFirstIncompleteMigration } from './selectors';

export const machine = createMachine<
  AutomaticMigrationState,
  AutomaticMigrationEvents
>(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QFsCWUBOBDALmAxADYD2WEAkgHao6paEAiuWA2gAwC6ioADsbDVTFK3EAA9EbAHQAmAIwAOBXLkB2AJyqALADYtbLTIA0IAJ6IdO9VJ0GAzGx0yZOgKwGAvh5NpMuAgCuPBD+ALJgOGTM7FxIIHwCtMKiEgiKOlJauuqu6mzqCqquyibmCG4ZMppsMmxsdupy6k5ePujYeFI8WAGwkPiwkRg4AEoBlNSUUDGiCYLJcalyupmqVa6ubjLKdtqliHIyNgquLpZshzraWnatIL4dYFIY45NQ+N29YDNxc0kiiwOqjkUk2qjsWjUkMsy32aQUdlkWRceS06js2wxdwe-mer1QU3wP14-HmANAqWKINUOgUVS0SkU+nUcO0oI0lgxllcWTU2PauJeEwJ7xYcliJMSQnJ4kQm0R8kMtg2+RkuzhyxBclcTVcawMbFcENU-L8nSFbyJMgl8VJ-xScrsiMMevUMlUbGBemMZkQLkRbo2BQ2Gl0rlNjzxwsJLDsNr+0odCFy1jq2jkTlpCNUCjhLqk6kLymKVXyWhpEdxlDAkFgIzAADdUGAAO4fHp9Ym2qULCmIAC0y1BhuUarUPIUzVccIcCikRScwLYk6KDRN3nuAs61dr9abraJnFmdsTgIQ7qOwPcziyy9pPrK+mk6Lccgh2rkBgUOi8G8oxAgOBRBxPBjx7GVUn7JxhypMcigZKc4X7NkdF2Nx8mKBDNErTpPj6CAwLJJN+2sKwXCURdilpcs4TdKQMTsJwZB1eoaTpHCngtEVCPtM9GMqZQ6TdHQVEMAxWTnL9tTydQshzdEOKkHcIDrRtmxbHjTz7BA7CaKRs3cXZCyqSw4UM0E1TyXTyLsBQtEUiBhDATTe1lBAdn01RgWcK4GiyLQ8znYp6i0TZJ3cE51F-DwgA */
    predictableActionArguments: true,
    preserveActionOrder: true,
    id: 'migrate',
    initial: 'init',
    context: {
      reviewedMigrations: [],
    },
    states: {
      init: {
        on: {
          startRunning: [
            {
              target: 'running',
            },
          ],
        },
      },
      paused: {
        on: {
          startRunning: [
            {
              target: 'running',
            },
          ],
          reviewMigration: [
            {
              cond: 'currentMigrationCanLeaveReview',
              target: 'running',
              actions: assign((ctx, event) => {
                ctx.reviewedMigrations.push(event.migrationId);
              }),
            },
          ],
        },
      },
      running: {
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
          reviewMigration: {
            cond: 'currentMigrationCanLeaveReview',
            target: 'running',
            actions: assign((ctx, event) => {
              ctx.reviewedMigrations.push(event.migrationId);
            }),
          },
        },
        always: [
          {
            cond: 'currentMigrationCanLeaveReview',
            target: 'running',
          },
        ],
      },
      done: {},
    },
    on: {
      loadInitialData: [
        {
          actions: [
            assign((ctx, event) => {
              ctx.migrations = event.migrations;
              ctx.nxConsoleMetadata = event.metadata;
              ctx.currentMigration =
                event.migrations.find(
                  (m) => m.id === event.currentMigrationId
                ) ??
                findFirstIncompleteMigration(event.migrations, event.metadata);
            }),
          ],
        },
      ],
      updateMetadata: [
        {
          actions: [
            assign((ctx, event) => {
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
      reviewMigration: [
        {
          actions: [
            assign((ctx, event) => {
              ctx.reviewedMigrations = [
                ...ctx.reviewedMigrations,
                event.migrationId,
              ];
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
