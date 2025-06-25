import { createMachine } from 'xstate';
import { assign } from '@xstate/immer';
import type {
  AutomaticMigrationState,
  AutomaticMigrationEvents,
} from './types';
import { guards } from './guards';
import { findFirstIncompleteMigration } from './selectors';

export const machine = createMachine<
  AutomaticMigrationState,
  AutomaticMigrationEvents
>(
  {
    id: 'migrate',
    initial: 'init',
    predictableActionArguments: true,
    preserveActionOrder: true,
    context: {
      reviewedMigrations: [],
    },
    states: {
      init: {
        on: {
          startRunning: {
            target: 'evaluate',
          },
        },
      },

      evaluate: {
        always: [
          {
            cond: 'lastMigrationIsDone',
            target: 'done',
          },
          {
            cond: 'currentMigrationIsDone',
            target: 'increment',
          },
          {
            cond: 'canStartRunningCurrentMigration',
            target: 'running',
          },
          {
            cond: 'needsReview',
            target: 'needsReview',
          },
        ],
      },

      increment: {
        entry: 'incrementCurrentMigration',
        always: 'evaluate',
      },

      running: {
        entry: ['runMigration'],
        on: {
          stop: {
            target: 'evaluate',
          },
        },
      },

      stopped: {
        on: {
          startRunning: {
            target: 'running',
          },
        },
      },

      needsReview: {
        on: {
          reviewMigration: {
            target: 'evaluate',
            actions: assign((ctx, event) => {
              ctx.reviewedMigrations.push(event.migrationId);
            }),
          },
          startRunning: {
            target: 'evaluate',
          },
        },
      },

      done: {},
    },

    on: {
      loadInitialData: {
        actions: assign((ctx, event) => {
          ctx.migrations = event.migrations;
          ctx.nxConsoleMetadata = event.metadata;
          ctx.currentMigration =
            event.migrations.find((m) => m.id === event.currentMigrationId) ??
            findFirstIncompleteMigration(event.migrations, event.metadata);
        }),
      },

      updateMetadata: [
        {
          cond: (ctx, event) => {
            const type =
              event.metadata.completedMigrations?.[
                ctx.currentMigration?.id ?? ''
              ]?.type;
            return type === 'stopped';
          },
          target: 'stopped',
          actions: assign((ctx, event) => {
            ctx.nxConsoleMetadata = event.metadata;
          }),
        },
        {
          cond: (ctx, event) => {
            const type =
              event.metadata.completedMigrations?.[
                ctx.currentMigration?.id ?? ''
              ]?.type;
            return (
              type === 'failed' || type === 'skipped' || type === 'successful'
            );
          },
          target: 'evaluate',
          actions: assign((ctx, event) => {
            ctx.nxConsoleMetadata = event.metadata;
          }),
        },
        {
          actions: assign((ctx, event) => {
            ctx.nxConsoleMetadata = event.metadata;
          }),
        },
      ],

      reviewMigration: {
        actions: assign((ctx, event) => {
          ctx.reviewedMigrations = [
            ...ctx.reviewedMigrations,
            event.migrationId,
          ];
        }),
      },
    },
  },
  {
    guards,
    actions: {
      incrementCurrentMigration: assign((ctx) => {
        if (!ctx.migrations || !ctx.currentMigration) return;
        const index = ctx.migrations.findIndex(
          (m) => m.id === ctx.currentMigration?.id
        );
        if (index < ctx.migrations.length - 1) {
          ctx.currentMigration = ctx.migrations[index + 1];
        }
      }),
      runMigration: () => {
        // No-op, the actual action is handled in the UI
      },
    },
  }
);
