/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
// nx-ignore-next-line
import { type FileChange } from 'nx/src/devkit-exports';
/* eslint-enable @nx/enforce-module-boundaries */
import { useEffect, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Popover } from '@nx/graph/ui-common';
import { useInterpret, useSelector } from '@xstate/react';
import { machine as automaticMigrationMachine } from './state/automatic/machine';
import {
  MigrationInit,
  MigrationDone,
  MigrationSettingsPanel,
  AutomaticMigration,
} from './components';
import { currentMigrationHasChanges } from './state/automatic/selectors';

export interface MigrateUIProps {
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
  currentMigrationId?: string;
  onRunMigration: (
    migration: MigrationDetailsWithId,
    configuration: {
      createCommits: boolean;
    }
  ) => void;
  onRunMany: (
    migrations: MigrationDetailsWithId[],
    configuration: {
      createCommits: boolean;
      commitPrefix: string;
    }
  ) => void;
  onSkipMigration: (migration: MigrationDetailsWithId) => void;
  onCancel: () => void;
  onFinish: (squashCommits: boolean) => void;
  onFileClick: (
    migration: MigrationDetailsWithId,
    file: Omit<FileChange, 'content'>
  ) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
  onViewDocumentation: (migration: MigrationDetailsWithId) => void;
}

export enum PrimaryAction {
  RunMigrations = 'Run Migrations',
  PauseMigrations = 'Pause Migrations',
  ApproveChanges = 'Approve Changes to Continue',
  FinishWithoutSquashingCommits = 'Finish without squashing commits',
  FinishSquashingCommits = 'Finish (squash commits)',
}

export function MigrateUI(props: MigrateUIProps) {
  const [createCommits, setCreateCommits] = useState(true);
  const [commitPrefix, setCommitPrefix] = useState('');
  const [primaryAction, setPrimaryAction] = useState<PrimaryAction>(
    PrimaryAction.RunMigrations
  );
  // For popover
  const [isOpen, setIsOpen] = useState(false);

  const actor = useInterpret(automaticMigrationMachine, {
    actions: {
      runMigration: (ctx) => {
        console.log('runMigration', ctx.currentMigration);
        if (ctx.currentMigration) {
          props.onRunMigration(ctx.currentMigration, { createCommits });
        }
      },
    },
  });
  const isDone = useSelector(actor, (state) => state.matches('done'));
  const isInit = useSelector(actor, (state) => state.matches('init'));
  const isRunning = useSelector(actor, (state) => state.matches('running'));
  const currentMigration = useSelector(
    actor,
    (state) => state.context.currentMigration
  );
  const hasChanges = useSelector(actor, (state) =>
    currentMigrationHasChanges(state.context)
  );

  useEffect(() => {
    actor.send({
      type: 'loadInitialData',
      migrations: props.migrations,
      metadata: props.nxConsoleMetadata,
      currentMigrationId: props.currentMigrationId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only load initial data when migrations change
  }, [JSON.stringify(props.migrations)]);

  useEffect(() => {
    actor.send({
      type: 'updateMetadata',
      metadata: props.nxConsoleMetadata,
    });
  }, [props.nxConsoleMetadata, actor]);

  useEffect(() => {
    if (isDone) {
      setPrimaryAction(PrimaryAction.FinishSquashingCommits);
    }
  }, [isDone, primaryAction]);

  useEffect(() => {
    if (
      (primaryAction === PrimaryAction.ApproveChanges ||
        primaryAction === PrimaryAction.RunMigrations ||
        primaryAction === PrimaryAction.PauseMigrations) &&
      !isInit
    ) {
      setPrimaryAction(
        isRunning
          ? PrimaryAction.PauseMigrations
          : hasChanges
          ? PrimaryAction.ApproveChanges
          : PrimaryAction.RunMigrations
      );
    }
  }, [isRunning, primaryAction, isInit, hasChanges]);

  const handlePauseResume = () => {
    if (isRunning) {
      actor.send({ type: 'pause' });
    } else {
      actor.send({ type: 'startRunning' });
    }
  };

  const handlePrimaryActionSelection = () => {
    if (
      primaryAction === PrimaryAction.RunMigrations ||
      primaryAction === PrimaryAction.PauseMigrations
    ) {
      handlePauseResume();
    } else if (
      primaryAction === PrimaryAction.FinishWithoutSquashingCommits ||
      primaryAction === PrimaryAction.FinishSquashingCommits
    ) {
      props.onFinish(primaryAction === PrimaryAction.FinishSquashingCommits);
    }
  };

  if (isInit) {
    return (
      <MigrationInit onStart={() => actor.send({ type: 'startRunning' })} />
    );
  }

  if (isDone) {
    return (
      <MigrationDone
        onCancel={props.onCancel}
        onFinish={props.onFinish}
        shouldSquashCommits={createCommits}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden p-2">
      {/* Page Header */}
      <div className="flex shrink-0 items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            Migrating to {props.nxConsoleMetadata.targetVersion}
          </h2>

          {/* Migration Controls */}
        </div>

        {
          <MigrationSettingsPanel
            createCommits={createCommits}
            setCreateCommits={setCreateCommits}
            commitPrefix={commitPrefix}
            setCommitPrefix={setCommitPrefix}
          />
        }
      </div>
      <div className="flex-1 overflow-y-auto">
        <AutomaticMigration
          actor={actor}
          migrations={props.migrations}
          nxConsoleMetadata={props.nxConsoleMetadata}
          onRunMigration={(migration) =>
            props.onRunMigration(migration, { createCommits })
          }
          onSkipMigration={(migration) => props.onSkipMigration(migration)}
          onViewImplementation={(migration) =>
            props.onViewImplementation(migration)
          }
          onViewDocumentation={(migration) =>
            props.onViewDocumentation(migration)
          }
          onFileClick={props.onFileClick}
        />
      </div>
      <div className="bottom-0 flex shrink-0 justify-end gap-2 bg-transparent py-4">
        <div className="flex gap-2">
          <button
            onClick={props.onCancel}
            type="button"
            className="flex w-full items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
          >
            Cancel
          </button>
          <div className="group flex">
            <button
              onClick={handlePrimaryActionSelection}
              type="button"
              title={primaryAction}
              disabled={hasChanges}
              className="whitespace-nowrap rounded-l-md border border-blue-700 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:border-blue-400 disabled:bg-blue-400 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-600 dark:text-white hover:dark:bg-blue-700"
            >
              {primaryAction}
            </button>
            <div className="relative flex">
              <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                disabled={hasChanges}
                className="border-l-1 flex items-center rounded-r-md border border border-blue-700 bg-blue-500 px-2 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-blue-400 disabled:bg-blue-400 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-700 dark:text-white hover:dark:bg-blue-800"
              >
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              <Popover
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                position={{
                  left: '-14rem',
                  top: isDone ? '2.75rem' : '-9.75rem',
                }}
              >
                <ul className="p-2">
                  {!isDone && (
                    <>
                      {' '}
                      {!isRunning && (
                        <li
                          className="flex cursor-pointer items-center gap-2 p-2 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                          onClick={() => {
                            setPrimaryAction(PrimaryAction.RunMigrations);
                            setIsOpen(false);
                          }}
                        >
                          <span
                            className={
                              primaryAction === PrimaryAction.RunMigrations
                                ? 'inline-block'
                                : 'opacity-0'
                            }
                          >
                            <CheckIcon className="h-4 w-4" />
                          </span>
                          <span>{'Run Migrations'}</span>
                        </li>
                      )}
                      {isRunning && (
                        <li
                          className="flex cursor-pointer items-center gap-2 p-2 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                          onClick={() => {
                            setPrimaryAction(PrimaryAction.PauseMigrations);
                            setIsOpen(false);
                          }}
                        >
                          <span
                            className={
                              primaryAction === PrimaryAction.PauseMigrations
                                ? 'inline-block'
                                : 'opacity-0'
                            }
                          >
                            <CheckIcon className="h-4 w-4" />
                          </span>
                          <span>{'Pause Migrations'}</span>
                        </li>
                      )}
                      <div className="my-1 h-0.5 w-full bg-slate-300/30" />
                    </>
                  )}
                  <li
                    className="flex cursor-pointer items-center gap-2 p-2 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                    onClick={() => {
                      setPrimaryAction(PrimaryAction.FinishSquashingCommits);
                      setIsOpen(false);
                    }}
                  >
                    <span
                      className={
                        primaryAction === PrimaryAction.FinishSquashingCommits
                          ? 'inline-block'
                          : 'opacity-0'
                      }
                    >
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <span>Squash commits</span>
                  </li>
                  <li
                    className="flex cursor-pointer items-center gap-2 p-2 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                    onClick={() => {
                      setPrimaryAction(
                        PrimaryAction.FinishWithoutSquashingCommits
                      );
                      setIsOpen(false);
                    }}
                  >
                    <span
                      className={
                        primaryAction ===
                        PrimaryAction.FinishWithoutSquashingCommits
                          ? 'inline-block'
                          : 'opacity-0'
                      }
                    >
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <span>Do not squash commits</span>
                  </li>
                </ul>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MigrateUI;
