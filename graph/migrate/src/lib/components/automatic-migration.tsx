/* eslint-disable @nx/enforce-module-boundaries */
import { FileChange } from 'nx/src/devkit-exports';
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */
import { useSelector } from '@xstate/react';
import {
  currentMigrationHasChanges,
  currentMigrationHasFailed,
  currentMigrationHasSucceeded,
} from '../state/automatic/selectors';
import { MigrationTimeline } from './migration-timeline';
import { Interpreter } from 'xstate';
import type {
  AutomaticMigrationEvents,
  AutomaticMigrationState,
} from '../state/automatic/types';

export function AutomaticMigration(props: {
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
  onRunMigration: (migration: MigrationDetailsWithId) => void;
  onSkipMigration: (migration: MigrationDetailsWithId) => void;
  onUndoMigration: (migration: MigrationDetailsWithId) => void;
  onFileClick: (
    migration: MigrationDetailsWithId,
    file: Omit<FileChange, 'content'>
  ) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
  onViewDocumentation: (migration: MigrationDetailsWithId) => void;
  actor: Interpreter<
    AutomaticMigrationState,
    any,
    AutomaticMigrationEvents,
    any,
    any
  >;
}) {
  const currentMigration = useSelector(
    props.actor,
    (state) => state.context.currentMigration
  );

  const currentMigrationIndex = props.migrations.findIndex(
    (migration) => migration.id === currentMigration?.id
  );

  const currentMigrationRunning = useSelector(
    props.actor,
    (state) => state.context.currentMigrationRunning
  );

  const currentMigrationFailed = useSelector(props.actor, (state) =>
    currentMigrationHasFailed(state.context)
  );

  const currentMigrationSuccess = useSelector(props.actor, (state) =>
    currentMigrationHasSucceeded(state.context)
  );

  const currentMigrationChanges = useSelector(props.actor, (state) =>
    currentMigrationHasChanges(state.context)
  );

  const isDone = useSelector(props.actor, (state) => state.matches('done'));

  const isInit = useSelector(props.actor, (state) => state.matches('init'));

  const handleReviewMigration = (migrationId: string) => {
    props.actor.send({
      type: 'reviewMigration',
      migrationId,
    });
  };

  return (
    <MigrationTimeline
      migrations={props.migrations}
      nxConsoleMetadata={props.nxConsoleMetadata}
      currentMigrationIndex={
        currentMigrationIndex >= 0 ? currentMigrationIndex : 0
      }
      currentMigrationRunning={currentMigrationRunning}
      currentMigrationFailed={currentMigrationFailed}
      currentMigrationSuccess={currentMigrationSuccess}
      currentMigrationHasChanges={currentMigrationChanges}
      isDone={isDone}
      isInit={isInit}
      onRunMigration={props.onRunMigration}
      onSkipMigration={props.onSkipMigration}
      onUndoMigration={props.onUndoMigration}
      onFileClick={props.onFileClick}
      onViewImplementation={props.onViewImplementation}
      onViewDocumentation={props.onViewDocumentation}
      onReviewMigration={handleReviewMigration}
    />
  );
}
