/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationsJsonEntry } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import { createMachine } from 'xstate';
import { assign } from '@xstate/immer';

type NxConsoleMetadata = {
  successfulMigrations?: string[];
};
export interface MigrateState {
  migrations: MigrationsJsonEntry[];
  nxConsoleMetadata: NxConsoleMetadata;
}

export type MigrateEvents = {
  type: 'loadData';
  migrations: MigrationsJsonEntry[];
  'nx-console': NxConsoleMetadata;
};

const initialContext: MigrateState = {
  migrations: [],
  nxConsoleMetadata: {},
};

export const migrateMachine = createMachine<MigrateState, MigrateEvents>({
  predictableActionArguments: true,
  preserveActionOrder: true,
  id: 'migrate',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {},
    loaded: {},
  },
  on: {
    loadData: [
      {
        target: 'loaded',
        actions: [
          assign((ctx, event) => {
            ctx.migrations = event.migrations;
            ctx.nxConsoleMetadata = event['nx-console'];
          }),
        ],
      },
    ],
  },
});
