/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { GeneratedMigrationDetails } from 'nx/src/config/misc-interfaces';
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

  const onRunMigration = (
    migration: GeneratedMigrationDetails,
    configuration: {
      createCommits: boolean;
    }
  ) => {
    externalApiService.postEvent({
      type: 'run-migration',
      payload: {
        migration,
        configuration,
      },
    });
  };

  const onCancel = () => {
    externalApiService.postEvent({
      type: 'cancel',
    });
  };

  const onFinish = () => {
    externalApiService.postEvent({
      type: 'finish',
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
      onCancel={onCancel}
      onFinish={onFinish}
    ></MigrateUI>
  );
}
