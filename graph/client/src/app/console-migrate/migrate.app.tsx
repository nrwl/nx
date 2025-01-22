/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { GeneratedMigrationDetails } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import { FileChange } from 'nx/src/devkit-exports';
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

  const onRunMany = (
    migrations: GeneratedMigrationDetails[],
    configuration: {
      createCommits: boolean;
    }
  ) => {
    externalApiService.postEvent({
      type: 'run-many',
      payload: {
        migrations,
        configuration,
      },
    });
  };

  const onCancel = () => {
    externalApiService.postEvent({
      type: 'cancel',
    });
  };

  const onFinish = (squashCommits: boolean) => {
    externalApiService.postEvent({
      type: 'finish',
      payload: {
        squashCommits,
      },
    });
  };

  const migrations = useSelector(service, (state) => state.context.migrations);
  const nxConsoleMetadata = useSelector(
    service,
    (state) => state.context.nxConsoleMetadata
  );
  const onFileClick = (file: FileChange) => {
    externalApiService.postEvent({
      type: 'file-click',
      payload: {
        path: file.path,
      },
    });
  };

  return (
    <MigrateUI
      migrations={migrations}
      nxConsoleMetadata={nxConsoleMetadata}
      onRunMigration={onRunMigration}
      onRunMany={onRunMany}
      onCancel={onCancel}
      onFinish={onFinish}
      onFileClick={onFileClick}
    ></MigrateUI>
  );
}
