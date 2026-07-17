// nx-ignore-next-line
import { FileChange } from 'nx/src/devkit-exports';
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';

import {
  ChevronUpIcon,
  ChevronDownIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  MinusIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState, useRef } from 'react';
import { MigrationCard, MigrationCardHandle } from './migration-card';
import { Collapsible } from '@nx/graph-ui-common';
import { twMerge } from 'tailwind-merge';
import type { Interpreter } from 'xstate';
import type {
  AutomaticMigrationState,
  AutomaticMigrationEvents,
} from '../state/automatic/types';
import { useSelector } from '@xstate/react';
import {
  getMigrationType,
  isMigrationRunning,
} from '../state/automatic/selectors';
import {
  isHybridShape,
  isPromptOnlyShape,
  type MigrationsJsonMetadata,
} from '../migration-shape';

export interface MigrationTimelineProps {
  actor: Interpreter<
    AutomaticMigrationState,
    any,
    AutomaticMigrationEvents,
    any,
    any
  >;

  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
  currentMigrationIndex: number;
  currentMigrationFailed?: boolean;
  currentMigrationSuccess?: boolean;
  currentMigrationHasChanges?: boolean;
  currentMigrationStopped?: boolean;
  isDone?: boolean;
  isInit: boolean;
  onRunMigration: (migration: MigrationDetailsWithId) => void;
  onSkipMigration: (migration: MigrationDetailsWithId) => void;
  onUndoMigration: (migration: MigrationDetailsWithId) => void;
  onAcknowledgePrompt: (migration: MigrationDetailsWithId) => void;
  onFileClick: (
    migration: MigrationDetailsWithId,
    file: Omit<FileChange, 'content'>
  ) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
  onViewDocumentation: (migration: MigrationDetailsWithId) => void;
  onViewPrompt: (migration: MigrationDetailsWithId) => void;
  onCancel?: () => void;
  onReviewMigration: (migrationId: string) => void;
}

export function MigrationTimeline({
  actor,
  migrations,
  nxConsoleMetadata,
  currentMigrationIndex,
  currentMigrationFailed,
  currentMigrationSuccess,
  currentMigrationHasChanges,
  currentMigrationStopped,
  onRunMigration,
  onSkipMigration,
  onUndoMigration,
  onAcknowledgePrompt,
  onFileClick,
  onViewImplementation,
  onViewDocumentation,
  onViewPrompt,
  onCancel,
  onReviewMigration,
}: MigrationTimelineProps) {
  const [showAllPastMigrations, setShowAllPastMigrations] = useState(false);
  const [showAllFutureMigrations, setShowAllFutureMigrations] = useState(false);
  const [expandedMigrations, setExpandedMigrations] = useState<{
    [key: string]: boolean;
  }>({});

  const currentMigration = migrations[currentMigrationIndex];
  const pastMigrations = migrations.slice(0, currentMigrationIndex);
  const futureMigrations = migrations.slice(currentMigrationIndex + 1);

  // Number of visible migrations when collapsed
  const visiblePastCount = 0;
  const visibleFutureCount = 2;
  const visiblePastMigrations = showAllPastMigrations
    ? pastMigrations
    : pastMigrations.slice(
        Math.max(0, pastMigrations.length - visiblePastCount)
      );
  const visibleFutureMigrations = showAllFutureMigrations
    ? futureMigrations
    : futureMigrations.slice(0, visibleFutureCount);

  const hasPastMigrationsHidden =
    pastMigrations.length > visiblePastCount && !showAllPastMigrations;
  const hasFutureMigrationsHidden =
    futureMigrations.length > visibleFutureCount && !showAllFutureMigrations;

  const currentMigrationRef = useRef<MigrationCardHandle>(null);

  // Auto-expand when entering a failed migration or requires review (including
  // prompt-only-pending, where the user needs to confirm they ran the prompt).
  const promptOnlyPending =
    !!currentMigration &&
    isPromptOnlyShape(currentMigration) &&
    !currentMigrationSuccess;
  // Hybrid post-generator entries also need explicit ack — even when the
  // generator produced no diff (otherwise the machine would silently advance
  // past the prompt phase).
  const currentEntry = currentMigration
    ? nxConsoleMetadata.completedMigrations?.[currentMigration.id]
    : undefined;
  const hybridNeedsAck =
    !!currentMigration &&
    isHybridShape(currentMigration) &&
    currentEntry?.type === 'successful' &&
    !currentEntry.acknowledgedPrompt;
  useEffect(() => {
    if (
      currentMigrationFailed ||
      currentMigrationHasChanges ||
      currentMigrationStopped ||
      promptOnlyPending ||
      hybridNeedsAck
    ) {
      toggleMigrationExpanded(currentMigration.id, true);
    } else {
      toggleMigrationExpanded(currentMigration.id, false);
    }
  }, [
    currentMigrationHasChanges,
    currentMigrationFailed,
    currentMigration,
    currentMigrationStopped,
    promptOnlyPending,
    hybridNeedsAck,
  ]);

  const toggleMigrationExpanded = (migrationId: string, state?: boolean) => {
    setExpandedMigrations((prev) => ({
      ...prev,
      [migrationId]: state ?? !prev[migrationId],
    }));
  };

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex w-full justify-between">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
          >
            Cancel the migration
          </button>
        )}
      </div>

      <div className="relative w-full pl-10">
        {/* Timeline lines */}
        {/* Solid line for visible migrations */}
        <div
          className="absolute top-0 left-10 w-0.5 -translate-x-1/2 bg-slate-200"
          style={{
            height: hasFutureMigrationsHidden ? 'calc(100% - 15%)' : '100%',
          }}
        ></div>

        {/* Dashed line for the section after the last visible migration */}
        {hasFutureMigrationsHidden && (
          <div
            className="absolute bottom-0 left-10 w-0.5 -translate-x-1/2 border-l-2 border-dashed border-slate-200"
            style={{
              height: '15%',
            }}
          ></div>
        )}

        {/* Timeline container */}
        <div className="flex flex-col">
          {/* Past migrations section */}
          {pastMigrations.length > 0 && (
            <>
              {showAllPastMigrations && (
                <div
                  key="show-past-migrations"
                  className="relative mb-6 w-full"
                >
                  <TimelineButton
                    icon={ChevronDownIcon}
                    onClick={() => setShowAllPastMigrations(false)}
                  />

                  <div className="ml-6">
                    <div
                      className="flex cursor-pointer items-center"
                      onClick={() => setShowAllPastMigrations(false)}
                    >
                      <span className="text-sm font-medium text-slate-600">
                        Hide Past Migrations
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {visiblePastMigrations.map((migration) => (
                <div key={migration.id} className="relative mb-6 w-full">
                  <MigrationStateCircle
                    actor={actor}
                    migration={migration}
                    nxConsoleMetadata={nxConsoleMetadata}
                    onClick={() => toggleMigrationExpanded(migration.id)}
                  />

                  <div
                    className={twMerge(
                      `mt-1 ml-6`,
                      expandedMigrations[currentMigration.id] ? '-mt-1' : ''
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex w-full items-center gap-4 font-medium">
                        <span
                          onClick={() => toggleMigrationExpanded(migration.id)}
                          className={`flex-shrink-0 cursor-pointer text-base whitespace-nowrap ${
                            nxConsoleMetadata.completedMigrations?.[
                              migration.id
                            ]?.type === 'successful'
                              ? 'text-green-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {migration.name}
                        </span>
                        {!expandedMigrations[migration.id] && (
                          <span className="w-0 flex-1 truncate text-sm text-slate-600/50">
                            {' '}
                            {migration.description}{' '}
                          </span>
                        )}
                      </div>
                      {expandedMigrations[migration.id] && (
                        <div className="flex gap-2">
                          {nxConsoleMetadata.completedMigrations?.[migration.id]
                            ?.type === 'failed' && (
                            <button
                              onClick={() => {
                                toggleMigrationExpanded(migration.id);
                                onRunMigration(migration);
                              }}
                              type="button"
                              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                            >
                              <ArrowPathIcon
                                className="h-5 w-5"
                                aria-hidden="true"
                              />{' '}
                              Rerun
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <Collapsible
                      isOpen={expandedMigrations[migration.id]}
                      className="mt-2 w-full rounded-md border border-slate-300 p-3"
                    >
                      <MigrationCard
                        actor={actor}
                        migration={migration}
                        isExpanded={expandedMigrations[migration.id]}
                        nxConsoleMetadata={nxConsoleMetadata}
                        onFileClick={(file) => onFileClick(migration, file)}
                        onViewImplementation={() =>
                          onViewImplementation(migration)
                        }
                        onViewDocumentation={() =>
                          onViewDocumentation(migration)
                        }
                        onViewPrompt={() => onViewPrompt(migration)}
                      />
                    </Collapsible>
                  </div>
                </div>
              ))}

              {hasPastMigrationsHidden && (
                <div
                  key="show-past-migrations"
                  className="relative mb-6 w-full"
                >
                  <TimelineButton
                    icon={ChevronUpIcon}
                    onClick={() => setShowAllPastMigrations(true)}
                  />

                  <div className="ml-6">
                    <div
                      className="flex cursor-pointer items-center"
                      onClick={() => setShowAllPastMigrations(true)}
                    >
                      <span className="text-sm font-medium text-slate-600">
                        Show Past Migrations
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Current migration */}
          <div className="relative">
            {/* TODO: Change this to be a clickable element li, button etc... */}
            <div>
              <MigrationStateCircle
                actor={actor}
                migration={migrations[currentMigrationIndex]}
                nxConsoleMetadata={nxConsoleMetadata}
                isCurrent
                needsAttention={
                  currentMigrationHasChanges &&
                  !expandedMigrations[currentMigration.id]
                }
                onClick={() => toggleMigrationExpanded(currentMigration.id)}
              />
              <div
                className={twMerge(
                  `mt-1 ml-6`,
                  expandedMigrations[currentMigration.id] ? '-mt-1' : ''
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex w-full items-center gap-4 font-medium">
                    <span
                      className="flex-shrink-0 cursor-pointer whitespace-nowrap"
                      onClick={() =>
                        toggleMigrationExpanded(currentMigration.id)
                      }
                    >
                      {currentMigration.name}
                    </span>
                    {!expandedMigrations[currentMigration.id] && (
                      <p className="w-0 flex-1 truncate text-sm">
                        {currentMigration.description}
                      </p>
                    )}
                  </div>
                  {expandedMigrations[currentMigration.id] && (
                    <div className="flex flex-shrink-0 gap-2">
                      {currentMigrationFailed && (
                        <button
                          onClick={() => {
                            toggleMigrationExpanded(currentMigration.id);
                            onRunMigration(currentMigration);
                          }}
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                        >
                          <ArrowPathIcon
                            className="h-5 w-5"
                            aria-hidden="true"
                          />{' '}
                          Rerun
                        </button>
                      )}
                      {!currentMigrationSuccess && (
                        <button
                          onClick={() => {
                            toggleMigrationExpanded(currentMigration.id);
                            onSkipMigration(currentMigration);
                          }}
                          type="button"
                          className="flex items-center rounded-md border border-red-500 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-red-600 dark:border-red-700 dark:bg-red-600 hover:dark:bg-red-700"
                        >
                          <XMarkIcon className="h-5 w-5" aria-hidden="true" />{' '}
                          Skip
                        </button>
                      )}

                      {currentMigrationHasChanges && (
                        <button
                          onClick={() => {
                            toggleMigrationExpanded(currentMigration.id);
                            onUndoMigration(currentMigration);
                          }}
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                        >
                          <XMarkIcon className="h-5 w-5" aria-hidden="true" />{' '}
                          Undo and Skip
                        </button>
                      )}
                      {(currentMigrationHasChanges ||
                        isPromptOnlyShape(currentMigration) ||
                        hybridNeedsAck) && (
                        <button
                          onClick={() => {
                            toggleMigrationExpanded(currentMigration.id);
                            onReviewMigration(currentMigration.id);
                            // Prompt-bearing migrations bundle the AI-prompt
                            // acknowledgement into this click — one button
                            // sets the local review flag and (via the backend)
                            // either records success for prompt-only or sets
                            // the acknowledgedPrompt flag for hybrid.
                            if (
                              isPromptOnlyShape(currentMigration) ||
                              isHybridShape(currentMigration)
                            ) {
                              onAcknowledgePrompt(currentMigration);
                            }
                          }}
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-blue-600 dark:border-blue-600 dark:bg-blue-600 hover:dark:bg-blue-700"
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />{' '}
                          {currentMigrationHasChanges
                            ? 'Approve Changes'
                            : 'Mark as Run'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <Collapsible
                  className="mt-2 w-full rounded-md border border-slate-300/60"
                  isOpen={expandedMigrations[currentMigration.id]}
                >
                  {/* Migration Card */}
                  <MigrationCard
                    actor={actor}
                    ref={currentMigrationRef}
                    migration={currentMigration}
                    isExpanded={expandedMigrations[currentMigration.id]}
                    nxConsoleMetadata={nxConsoleMetadata}
                    onFileClick={(file) => onFileClick(currentMigration, file)}
                    onViewImplementation={() =>
                      onViewImplementation(currentMigration)
                    }
                    onViewDocumentation={() =>
                      onViewDocumentation(currentMigration)
                    }
                    onViewPrompt={() => onViewPrompt(currentMigration)}
                  />
                </Collapsible>
              </div>
            </div>
          </div>

          {/* Future migrations */}
          {futureMigrations.length > 0 && (
            <>
              {visibleFutureMigrations.map((migration) => (
                <div key={migration.id} className="relative mt-6 w-full">
                  <MigrationStateCircle
                    actor={actor}
                    migration={migration}
                    nxConsoleMetadata={nxConsoleMetadata}
                    onClick={() => toggleMigrationExpanded(migration.id)}
                  />

                  <div
                    className={twMerge(
                      `mt-1 ml-6`,
                      expandedMigrations[migration.id] &&
                        !nxConsoleMetadata.completedMigrations?.[migration.id]
                        ? '-mt-1'
                        : ''
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex w-full items-center gap-4">
                        <span
                          className="flex-shrink-0 cursor-pointer whitespace-nowrap"
                          onClick={() => toggleMigrationExpanded(migration.id)}
                        >
                          {migration.name}
                        </span>
                        {!expandedMigrations[migration.id] && (
                          <span className="w-0 flex-1 truncate text-sm text-slate-600/50">
                            {migration.description}{' '}
                          </span>
                        )}
                      </div>
                      {/* ONLY SHOW BUTTONS FOR PENDING MIGRATIONS */}
                      {expandedMigrations[migration.id] &&
                        !nxConsoleMetadata.completedMigrations?.[
                          migration.id
                        ] && (
                          <div className="flex flex-shrink-0 gap-2">
                            <button
                              onClick={() => {
                                toggleMigrationExpanded(migration.id);
                                onSkipMigration(migration);
                              }}
                              type="button"
                              className="flex items-center gap-2 rounded-md border border-red-500 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-red-600 dark:border-red-700 dark:bg-red-600 hover:dark:bg-red-700"
                            >
                              <XMarkIcon
                                className="h-5 w-5"
                                aria-hidden="true"
                              />{' '}
                              Skip
                            </button>
                          </div>
                        )}
                    </div>
                    <Collapsible
                      isOpen={expandedMigrations[migration.id]}
                      className="mt-2 w-full rounded-md border border-slate-300/50 p-3"
                    >
                      <MigrationCard
                        actor={actor}
                        migration={migration}
                        nxConsoleMetadata={nxConsoleMetadata}
                        isExpanded={expandedMigrations[migration.id]}
                        onFileClick={(file) => onFileClick(migration, file)}
                        onViewImplementation={() =>
                          onViewImplementation(migration)
                        }
                        onViewDocumentation={() =>
                          onViewDocumentation(migration)
                        }
                        onViewPrompt={() => onViewPrompt(migration)}
                      />
                    </Collapsible>
                  </div>
                </div>
              ))}

              {hasFutureMigrationsHidden && (
                <div
                  key="show-future-migrations"
                  className="relative mt-9 mb-1 w-full"
                >
                  <TimelineButton
                    icon={ChevronDownIcon}
                    onClick={() => setShowAllFutureMigrations(true)}
                  />

                  <div className="ml-6">
                    <div
                      className="flex cursor-pointer items-center"
                      onClick={() => setShowAllFutureMigrations(true)}
                    >
                      <span className="text-sm font-medium text-slate-600">
                        Show more
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {showAllFutureMigrations && (
                <div
                  key="show-future-migrations"
                  className="relative mt-6 mb-1 w-full"
                >
                  <TimelineButton
                    icon={ChevronUpIcon}
                    onClick={() => setShowAllFutureMigrations(false)}
                  />

                  <div className="ml-6">
                    <div
                      className="flex cursor-pointer items-center"
                      onClick={() => setShowAllFutureMigrations(false)}
                    >
                      <span className="text-sm font-medium text-slate-600">
                        Show fewer
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface TimelineButtonProps {
  icon: React.ElementType;
  onClick: () => void;
}

function TimelineButton({ icon: Icon, onClick }: TimelineButtonProps) {
  return (
    <div
      className="absolute top-0 left-0 flex h-6 w-6 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-slate-300 text-slate-700"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

interface MigrationStateCircleProps {
  actor: Interpreter<
    AutomaticMigrationState,
    any,
    AutomaticMigrationEvents,
    any,
    any
  >;
  migration: MigrationDetailsWithId;
  nxConsoleMetadata: MigrationsJsonMetadata;
  isCurrent?: boolean;
  needsAttention?: boolean;
  onClick: () => void;
}

function MigrationStateCircle({
  actor,
  migration,
  nxConsoleMetadata,
  isCurrent,
  needsAttention,
  onClick,
}: MigrationStateCircleProps) {
  let bgClassName = '';
  let textColor = '';
  let Icon = null;

  const isSkipped = useSelector(
    actor,
    (state) => getMigrationType(state.context, migration.id) === 'skipped'
  );

  const isRunning = useSelector(actor, (state) =>
    isMigrationRunning(state.context, migration.id)
  );
  const isStopped = useSelector(
    actor,
    (state) => getMigrationType(state.context, migration.id) === 'stopped'
  );
  const isFailed = useSelector(
    actor,
    (state) => getMigrationType(state.context, migration.id) === 'failed'
  );
  const isSuccess = useSelector(
    actor,
    (state) => getMigrationType(state.context, migration.id) === 'successful'
  );

  const completed = nxConsoleMetadata.completedMigrations?.[migration.id];
  const acknowledgedPrompt =
    completed?.type === 'successful' && !!completed.acknowledgedPrompt;
  const showHybridPendingAck =
    isHybridShape(migration) && isSuccess && !acknowledgedPrompt;

  if (isRunning) {
    // Prioritize running state - show spinner even if metadata still shows stopped
    bgClassName = 'bg-blue-500';
    textColor = 'text-white';
    Icon = ClockIcon;
  } else if (isSkipped) {
    bgClassName = 'bg-slate-300';
    textColor = 'text-slate-700';
    Icon = MinusIcon;
  } else if (isFailed) {
    bgClassName = 'bg-red-500';
    textColor = 'text-white';
    Icon = ExclamationCircleIcon;
  } else if (isStopped) {
    bgClassName = 'bg-yellow-500';
    textColor = 'text-white';
    Icon = XMarkIcon;
  } else if (isSuccess) {
    bgClassName = 'bg-green-500';
    textColor = 'text-white';
    Icon = CheckCircleIcon;
  } else if (isCurrent && isPromptOnlyShape(migration)) {
    // Prompt-only pending: AI-blue circle with white clock until the user
    // marks it complete (which flips it to the success branch above). Only
    // for the current migration — future ones get the uniform gray dot.
    bgClassName = 'bg-sky-400';
    textColor = 'text-white';
    Icon = ClockIcon;
  } else {
    // Future migration (none of the states above)
    bgClassName = 'bg-slate-300';
    textColor = 'text-slate-700';
  }

  return (
    <div
      className={twMerge(
        !!Icon ? 'h-8 w-8' : 'mt-1 h-6 w-6',
        `absolute top-0 left-0 flex -translate-x-1/2 cursor-pointer items-center justify-center rounded-full ${bgClassName} ${textColor}`,
        needsAttention ? 'animate-pulse' : ''
      )}
      onClick={onClick}
    >
      {isRunning ? (
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : Icon ? (
        <Icon className="h-6 w-6" />
      ) : null}
      {showHybridPendingAck && (
        <span
          className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-slate-900"
          aria-hidden="true"
        >
          <ClockIcon className="h-3 w-3 text-sky-300" />
        </span>
      )}
    </div>
  );
}
