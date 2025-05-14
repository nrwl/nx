/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { assign } from '@xstate/immer';
import type {
  GeneratedMigrationDetails,
  MigrationDetailsWithId,
} from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */
import { createMachine } from 'xstate';
export interface MigrateState {
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
}

export type MigrateEvents = {
  type: 'loadData';
  migrations: GeneratedMigrationDetails[];
  'nx-console': MigrationsJsonMetadata;
};

const initialContext: MigrateState = {
  migrations: [],
  nxConsoleMetadata: {},
};

export const migrateMachine = createMachine<MigrateState, MigrateEvents>({
  /** @xstate-layout N4IgpgJg5mDOIC5QFsCWUBOBDALmAxADYD2WEAIrlgNoAMAuoqAA7Gyo6rEB2TIAHogAsAJgA0IAJ6IAjAGYAnADoAHDJFCAbAFYVtGTNpHtAXzMTuxCHD5pMuMH1btOPPoIQBaTROlfNSkZBwSEA7OYgdth4SqgQhI5IIM4cXLxJHpoySiIqcira2gqitEJBPlKIakpyIiIKMrql6kIqKhFRDkokZJBObKluGbKaynU6oXKKIjKaU+KVCLMiSqG02uvF2jqaeiJmZkA */
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
            ctx.migrations = event.migrations.map((migration, index) => {
              const duplicateCount = event.migrations
                .slice(0, index)
                .filter((m) => m.name === migration.name).length;
              return {
                ...migration,
                id:
                  duplicateCount === 0
                    ? migration.name
                    : `${migration.name}-${duplicateCount}`,
              };
            });
            ctx.nxConsoleMetadata = event['nx-console'];
          }),
        ],
      },
    ],
  },
});
