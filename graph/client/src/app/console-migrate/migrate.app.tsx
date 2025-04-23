/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import { type FileChange } from 'nx/src/devkit-exports';
import { MigrateUI } from '@nx/graph-migrate';
/* eslint-enable @nx/enforce-module-boundaries */

import { getExternalApiService } from '@nx/graph/legacy/shared';
import { useSelector } from '@xstate/react';
import { Interpreter } from 'xstate';
import { MigrateEvents, MigrateState } from './migrate.machine';

export function MigrateApp({
  service,
}: {
  service: Interpreter<MigrateState, any, MigrateEvents>;
}) {
  const externalApiService = getExternalApiService();

  const onRunMigration = (
    migration: MigrationDetailsWithId,
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
    migrations: MigrationDetailsWithId[],
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
  const onFileClick = (migration: MigrationDetailsWithId, file: FileChange) => {
    externalApiService.postEvent({
      type: 'file-click',
      payload: {
        path: file.path,
        migration: migration,
      },
    });
  };

  const onSkipMigration = (migration: MigrationDetailsWithId) => {
    externalApiService.postEvent({
      type: 'skip-migration',
      payload: { migration },
    });
  };

  const onViewImplementation = (migration: MigrationDetailsWithId) => {
    externalApiService.postEvent({
      type: 'view-implementation',
      payload: { migration },
    });
  };

  const onViewDocumentation = (migration: MigrationDetailsWithId) => {
    externalApiService.postEvent({
      type: 'view-documentation',
      payload: { migration },
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
      onSkipMigration={onSkipMigration}
      onViewImplementation={onViewImplementation}
      onViewDocumentation={onViewDocumentation}
    ></MigrateUI>
  );
}
