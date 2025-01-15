/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationsJsonEntry } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */

import { Interpreter } from 'xstate';
import { MigrateEvents, MigrateState } from './migrate.machine';
import { MigrateUI } from '@nx/graph-migrate';
import { useSelector } from '@xstate/react';
import { getExternalApiService } from '@nx/graph/shared';

export function MigrateApp({
  service,
}: {
  service: Interpreter<MigrateState, any, MigrateEvents>;
}) {
  const externalApiService = getExternalApiService();

  const onRunMigration = (migration: MigrationsJsonEntry) => {
    externalApiService.postEvent({
      type: 'run-migration',
      payload: {
        migration,
      },
    });
  };

  const migrations = useSelector(service, (state) => state.context.migrations);
  const nxConsoleMetadata = useSelector(
    service,
    (state) => state.context.nxConsoleMetadata
  );

  return (
    <MigrateUI
      migrations={migrations}
      nxConsoleMetadata={nxConsoleMetadata}
      onRunMigration={onRunMigration}
    ></MigrateUI>
  );
}
