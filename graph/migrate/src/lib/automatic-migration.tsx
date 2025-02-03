/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */
import { PauseIcon, PlayIcon } from '@heroicons/react/24/outline';
import { useInterpret, useSelector } from '@xstate/react';
import { useEffect, useState } from 'react';
import {
  automaticMigrationMachine,
  currentMigrationHasChanges,
  currentMigrationHasFailed,
} from './automatic-migration.machine';
import { MigrationCard } from './migration-card';
import { Pill } from '@nx/graph-internal/ui-project-details';

export function AutomaticMigration(props: {
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
  onRunMigration: (migration: MigrationDetailsWithId) => void;
  onSkipMigration: (migration: MigrationDetailsWithId) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
}) {
  const actor = useInterpret(automaticMigrationMachine, {
    actions: {
      runMigration: (ctx) => {
        console.log('runMigration', ctx.currentMigration);
        if (ctx.currentMigration) {
          props.onRunMigration(ctx.currentMigration);
        }
      },
    },
  });

  useEffect(() => {
    console.log('loading initial data');
    actor.send({
      type: 'loadInitialData',
      migrations: props.migrations,
      metadata: props.nxConsoleMetadata,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only load initial data when migrations change
  }, [JSON.stringify(props.migrations)]);

  useEffect(() => {
    actor.send({
      type: 'updateMetadata',
      metadata: props.nxConsoleMetadata,
    });
  }, [props.nxConsoleMetadata, actor]);

  const running = useSelector(actor, (state) => state.matches('running'));

  const currentMigration = useSelector(
    actor,
    (state) => state.context.currentMigration
  );

  const currentMigrationIndex = props.migrations.findIndex(
    (migration) => migration.id === currentMigration?.id
  );

  const beforeMigrations = props.migrations.slice(
    0,
    currentMigrationIndex ?? 0
  );
  const afterMigrations = props.migrations.slice(
    (currentMigrationIndex ?? 0) + 1
  );

  const currentMigrationRunning = useSelector(
    actor,
    (state) => state.context.currentMigrationRunning
  );

  const currentMigrationFailed = useSelector(actor, (state) =>
    currentMigrationHasFailed(state.context)
  );

  const currentMigrationChangesNeedReview = useSelector(
    actor,
    (state) =>
      state.matches('needsReview') && currentMigrationHasChanges(state.context)
  );

  const isDone = useSelector(actor, (state) => state.matches('done'));

  const [showCompletedMigrations, setShowCompletedMigrations] = useState(false);

  return (
    <div>
      <div
        className={`mb-2 ${
          showCompletedMigrations
            ? 'rounded-md border border-slate-200 p-2  dark:border-slate-700/60'
            : ''
        }`}
      >
        {beforeMigrations.length > 0 && (
          <div
            onClick={() => setShowCompletedMigrations(!showCompletedMigrations)}
          >
            <Pill
              color="grey"
              text={
                showCompletedMigrations
                  ? 'Hide completed migrations'
                  : `${beforeMigrations.length} completed migration${
                      beforeMigrations.length === 1 ? '' : 's'
                    }`
              }
            />
          </div>
        )}
        {showCompletedMigrations &&
          beforeMigrations.length &&
          beforeMigrations.map((migration) => (
            <MigrationCard
              key={migration.id}
              migration={migration}
              nxConsoleMetadata={props.nxConsoleMetadata}
              onFileClick={() => {}}
              onViewImplementation={() => {
                props.onViewImplementation(migration);
              }}
            />
          ))}
      </div>
      {!isDone && (
        <>
          <div>
            <div className="mb-2 flex items-center justify-start gap-2">
              <button
                onClick={() =>
                  running
                    ? actor.send({ type: 'pause' })
                    : actor.send({ type: 'startRunning' })
                }
                type="button"
                className="flex items-center rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 dark:border-blue-700 dark:bg-blue-600 dark:text-white hover:dark:bg-blue-700"
              >
                {running ? (
                  <PauseIcon className="mr-2 h-4 w-4" />
                ) : (
                  <PlayIcon className="mr-2 h-4 w-4" />
                )}
                {running ? 'Pause Migrations' : 'Run Migrations'}
              </button>
              {currentMigrationFailed && (
                <button
                  onClick={() =>
                    currentMigration
                      ? props.onRunMigration(currentMigration)
                      : undefined
                  }
                  type="button"
                  className="flex items-center rounded-md border border-red-500 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 dark:border-red-700 dark:bg-red-600 dark:text-white hover:dark:bg-red-700"
                >
                  Rerun
                </button>
              )}
              {currentMigrationFailed && (
                <button
                  onClick={() =>
                    currentMigration
                      ? props.onSkipMigration(currentMigration)
                      : undefined
                  }
                  type="button"
                  className="flex items-center rounded-md border border-yellow-500 bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600 dark:border-yellow-600 dark:bg-yellow-600 dark:text-white hover:dark:bg-yellow-700"
                >
                  Skip
                </button>
              )}
              {currentMigrationChangesNeedReview && (
                <button
                  onClick={() => {
                    if (currentMigration) {
                      actor.send({
                        type: 'reviewMigration',
                        migrationId: currentMigration?.id,
                      });
                    }
                  }}
                  type="button"
                  className="flex items-center rounded-md border border-green-500 bg-green-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-600 dark:border-green-700 dark:bg-green-600 dark:text-white hover:dark:bg-green-700"
                >
                  Approve Changes
                </button>
              )}
            </div>

            {currentMigration && (
              <div className="rounded-md border border-black p-3">
                <MigrationCard
                  migration={currentMigration}
                  nxConsoleMetadata={props.nxConsoleMetadata}
                  onFileClick={() => {}}
                  forceIsRunning={currentMigrationRunning}
                  onViewImplementation={() => {
                    props.onViewImplementation(currentMigration);
                  }}
                />
              </div>
            )}
          </div>
          <div className="p-3">
            {afterMigrations.map((migration) => (
              <MigrationCard
                key={migration.id}
                migration={migration}
                nxConsoleMetadata={props.nxConsoleMetadata}
                onFileClick={() => {}}
                onViewImplementation={() => {
                  props.onViewImplementation(migration);
                }}
              />
            ))}
          </div>
        </>
      )}
      {isDone && (
        <div className="rounded-md border border-black p-3">
          <h2 className="text-lg font-bold">All migrations completed</h2>
        </div>
      )}
    </div>
  );
}
