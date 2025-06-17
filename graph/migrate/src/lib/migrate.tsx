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
import {
  currentMigrationIsStopped,
  currentMigrationHasFailed,
} from './state/automatic/selectors';

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
  onUndoMigration: (migration: MigrationDetailsWithId) => void;
  onStopMigration: (migration: MigrationDetailsWithId) => void;
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
  const currentMigration = useSelector(
    actor,
    (state) => state.context.currentMigration
  );

  const isDone = useSelector(actor, (state) => state.matches('done'));
  const isInit = useSelector(actor, (state) => state.matches('init'));
  const isRunning = useSelector(actor, (state) => state.matches('running'));
  const isCurrentMigrationStopped = useSelector(actor, (state) =>
    currentMigrationIsStopped(state.context)
  );
  const isCurrentMigrationFailed = useSelector(actor, (state) =>
    currentMigrationHasFailed(state.context)
  );

  const isNeedReview = useSelector(actor, (state) =>
    state.matches('needsReview')
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
        primaryAction === PrimaryAction.RunMigrations) &&
      !isInit
    ) {
      setPrimaryAction(
        isNeedReview && !isCurrentMigrationFailed
          ? PrimaryAction.ApproveChanges
          : PrimaryAction.RunMigrations
      );
    }
  }, [
    isRunning,
    primaryAction,
    isInit,
    isNeedReview,
    isCurrentMigrationFailed,
  ]);

  const handleStartMigration = () => {
    actor.send({ type: 'startRunning' });
  };

  const handlePrimaryActionSelection = () => {
    if (primaryAction === PrimaryAction.RunMigrations) {
      handleStartMigration();
    } else if (
      primaryAction === PrimaryAction.FinishWithoutSquashingCommits ||
      primaryAction === PrimaryAction.FinishSquashingCommits
    ) {
      props.onFinish(primaryAction === PrimaryAction.FinishSquashingCommits);
    }
  };

  const handleStopMigration = () => {
    if (!currentMigration) {
      return;
    }
    props.onStopMigration(currentMigration);
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
          onSkipMigration={props.onSkipMigration}
          onUndoMigration={props.onUndoMigration}
          onViewImplementation={props.onViewImplementation}
          onViewDocumentation={props.onViewDocumentation}
          onFileClick={props.onFileClick}
        />
      </div>
      <div className="bottom-0 flex shrink-0 justify-end gap-2 bg-transparent py-4">
        <button
          onClick={props.onCancel}
          type="button"
          className="flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
        >
          Cancel
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleStopMigration}
            disabled={isCurrentMigrationStopped || isNeedReview}
            type="button"
            className={`flex items-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm ${
              isCurrentMigrationStopped || isNeedReview
                ? 'cursor-not-allowed border-gray-300 bg-gray-300 text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400'
                : 'border-red-300 bg-red-500 text-white hover:bg-red-600 dark:border-red-600 dark:bg-red-600 hover:dark:bg-red-700'
            }`}
          >
            Stop Migration
          </button>

          <div className="group flex">
            <button
              onClick={handlePrimaryActionSelection}
              type="button"
              title={primaryAction}
              disabled={isNeedReview}
              className="whitespace-nowrap rounded-l-md border border-blue-700 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm enabled:hover:bg-blue-600 disabled:cursor-not-allowed disabled:border-blue-400 disabled:bg-blue-400 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-600 dark:text-white enabled:hover:dark:bg-blue-700"
            >
              {primaryAction}
            </button>
            <div className="relative flex">
              <button
                type="button"
                disabled={isNeedReview}
                onClick={() => setIsOpen((prev) => !prev)}
                className="border-l-1 flex items-center rounded-r-md border border-blue-700 bg-blue-500 px-2 py-2 text-sm font-medium text-white shadow-sm enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-blue-400 disabled:bg-blue-400 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-700 dark:text-white enabled:hover:dark:bg-blue-800"
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
                  <div className="my-1 h-0.5 w-full bg-slate-300/30" />
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
