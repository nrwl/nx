/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { FileChange } from '@nx/devkit';
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */
import { useInterpret, useSelector } from '@xstate/react';
import { useEffect } from 'react';
import {
  AutomaticMigrationEvents,
  automaticMigrationMachine,
  AutomaticMigrationState,
  currentMigrationHasChanges,
  currentMigrationHasFailed,
  currentMigrationHasSucceeded,
} from './automatic-migration.machine';
import { MigrationTimeline } from './migration-timeline';
import { Interpreter } from 'xstate';

export function AutomaticMigration(props: {
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
  onRunMigration: (migration: MigrationDetailsWithId) => void;
  onSkipMigration: (migration: MigrationDetailsWithId) => void;
  onFileClick: (
    migration: MigrationDetailsWithId,
    file: Omit<FileChange, 'content'>
  ) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
  onViewDocumentation: (migration: MigrationDetailsWithId) => void;
  actor: Interpreter<any, any, any, any, any>; // TODO Update with correct type
}) {
  // const actor = useInterpret(automaticMigrationMachine, {
  //   actions: {
  //     runMigration: (ctx) => {
  //       console.log('runMigration', ctx.currentMigration);
  //       if (ctx.currentMigration) {
  //         props.onRunMigration(ctx.currentMigration);
  //       }
  //     },
  //   },
  // });

  // useEffect(() => {
  //   console.log('loading initial data');
  //   actor.send({
  //     type: 'loadInitialData',
  //     migrations: props.migrations,
  //     metadata: props.nxConsoleMetadata,
  //   });
  //   // eslint-disable-next-line react-hooks/exhaustive-deps -- only load initial data when migrations change
  // }, [JSON.stringify(props.migrations)]);

  // useEffect(() => {
  //   actor.send({
  //     type: 'updateMetadata',
  //     metadata: props.nxConsoleMetadata,
  //   });
  // }, [props.nxConsoleMetadata, actor]);

  const running = useSelector(props.actor, (state) => state.matches('running'));

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

  const isDone = useSelector(props.actor, (state) => state.matches('done'));

  const handlePauseResume = () => {
    if (running) {
      props.actor.send({ type: 'pause' });
    } else {
      props.actor.send({ type: 'startRunning' });
    }
  };

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
      isDone={isDone}
      onRunMigration={props.onRunMigration}
      onSkipMigration={props.onSkipMigration}
      onFileClick={props.onFileClick}
      onViewImplementation={props.onViewImplementation}
      onViewDocumentation={props.onViewDocumentation}
      onPauseResume={handlePauseResume}
      isPaused={!running}
      onReviewMigration={handleReviewMigration}
    />
  );
}
