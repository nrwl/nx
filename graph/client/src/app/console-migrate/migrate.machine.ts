/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { GeneratedMigrationDetails } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import { createMachine } from 'xstate';
import { assign } from '@xstate/immer';
import { NxConsoleMigrateMetadata } from '@nx/graph-migrate';

export interface MigrateState {
  migrations: GeneratedMigrationDetails[];
  nxConsoleMetadata: NxConsoleMigrateMetadata;
}

export type MigrateEvents = {
  type: 'loadData';
  migrations: GeneratedMigrationDetails[];
  'nx-console': NxConsoleMigrateMetadata;
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
