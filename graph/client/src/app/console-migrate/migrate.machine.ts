/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationsJsonEntry } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import { createMachine } from 'xstate';
import { assign } from '@xstate/immer';

export interface MigrateState {
  migrations: MigrationsJsonEntry[];
}

export type MigrateEvents = {
  type: 'loadData';
  migrations: MigrationsJsonEntry[];
};

const initialContext: MigrateState = {
  migrations: [],
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
          }),
        ],
      },
    ],
  },
});
