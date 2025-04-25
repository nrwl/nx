/* eslint-disable @nx/enforce-module-boundaries */
import { FileChange } from 'nx/src/devkit-exports';
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';

/* eslint-enable @nx/enforce-module-boundaries */

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
import { Collapsible } from '@nx/graph/ui-common';
import { twMerge } from 'tailwind-merge';

export interface MigrationTimelineProps {
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
  currentMigrationIndex: number;
  currentMigrationRunning?: boolean;
  currentMigrationFailed?: boolean;
  currentMigrationSuccess?: boolean;
  currentMigrationHasChanges?: boolean;
  isDone?: boolean;
  isInit: boolean;
  onRunMigration: (migration: MigrationDetailsWithId) => void;
  onSkipMigration: (migration: MigrationDetailsWithId) => void;
  onFileClick: (
    migration: MigrationDetailsWithId,
    file: Omit<FileChange, 'content'>
  ) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
  onViewDocumentation: (migration: MigrationDetailsWithId) => void;
  onCancel?: () => void;
  onReviewMigration: (migrationId: string) => void;
}

export function MigrationTimeline({
  migrations,
  nxConsoleMetadata,
  currentMigrationIndex,
  currentMigrationRunning,
  currentMigrationFailed,
  currentMigrationSuccess,
  currentMigrationHasChanges,
  onRunMigration,
  onSkipMigration,
  onFileClick,
  onViewImplementation,
  onViewDocumentation,
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

  // Auto-expand when entering a failed migration or requires review
  useEffect(() => {
    if (currentMigrationFailed || currentMigrationHasChanges) {
      toggleMigrationExpanded(currentMigration.id, true);
    }
  }, [currentMigrationHasChanges, currentMigrationFailed, currentMigration]);

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
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Cancel the migration
          </button>
        )}
      </div>

      <div className="relative w-full pl-10">
        {/* Timeline lines */}
        {/* Solid line for visible migrations */}
        <div
          className="absolute left-10 top-0 w-0.5 bg-slate-200"
          style={{
            height: hasFutureMigrationsHidden ? 'calc(100% - 15%)' : '100%',
          }}
        ></div>

        {/* Dashed line for the section after the last visible migration */}
        {hasFutureMigrationsHidden && (
          <div
            className="absolute bottom-0 left-10 w-0.5 border-l-2 border-dashed border-slate-200"
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
                    migration={migration}
                    nxConsoleMetadata={nxConsoleMetadata}
                    onClick={() => toggleMigrationExpanded(migration.id)}
                  />

                  <div
                    className={twMerge(
                      `ml-6 mt-1`,
                      expandedMigrations[currentMigration.id] ? '-mt-1' : ''
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex w-full items-center gap-4 font-medium">
                        <span
                          onClick={() => toggleMigrationExpanded(migration.id)}
                          className={`flex-shrink-0 cursor-pointer whitespace-nowrap text-base ${
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
                              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
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
                migration={migrations[currentMigrationIndex]}
                nxConsoleMetadata={nxConsoleMetadata}
                needsAttention={
                  currentMigrationHasChanges &&
                  !expandedMigrations[currentMigration.id]
                }
                isRunning={currentMigrationRunning}
                onClick={() => toggleMigrationExpanded(currentMigration.id)}
              />
              <div
                className={twMerge(
                  `ml-6 mt-1`,
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
                          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
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
                          className="flex items-center rounded-md border border-red-500 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 dark:border-red-700 dark:bg-red-600 hover:dark:bg-red-700"
                        >
                          <XMarkIcon className="h-5 w-5" aria-hidden="true" />{' '}
                          Skip
                        </button>
                      )}

                      {currentMigrationHasChanges && (
                        <button
                          onClick={() => {
                            toggleMigrationExpanded(currentMigration.id);
                            onReviewMigration(currentMigration.id);
                          }}
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 dark:border-blue-600 dark:bg-blue-600 hover:dark:bg-blue-700"
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />{' '}
                          Approve Changes
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
                    ref={currentMigrationRef}
                    migration={currentMigration}
                    isExpanded={expandedMigrations[currentMigration.id]}
                    nxConsoleMetadata={nxConsoleMetadata}
                    onFileClick={(file) => onFileClick(currentMigration, file)}
                    forceIsRunning={currentMigrationRunning}
                    onViewImplementation={() =>
                      onViewImplementation(currentMigration)
                    }
                    onViewDocumentation={() =>
                      onViewDocumentation(currentMigration)
                    }
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
                    migration={migration}
                    nxConsoleMetadata={nxConsoleMetadata}
                    onClick={() => toggleMigrationExpanded(migration.id)}
                  />

                  <div
                    className={twMerge(
                      `ml-6 mt-1`,
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
                              className="flex items-center gap-2 rounded-md border border-red-500 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 dark:border-red-700 dark:bg-red-600 hover:dark:bg-red-700"
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
                      />
                    </Collapsible>
                  </div>
                </div>
              ))}

              {hasFutureMigrationsHidden && (
                <div
                  key="show-future-migrations"
                  className="relative mb-1 mt-9 w-full"
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
                  className="relative mb-1 mt-6 w-full"
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
      className="absolute left-0 top-0 flex h-6 w-6 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-slate-300 text-slate-700"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

interface MigrationStateCircleProps {
  migration: MigrationDetailsWithId;
  nxConsoleMetadata: MigrationsJsonMetadata;
  isRunning?: boolean;
  needsAttention?: boolean;
  onClick: () => void;
}

function MigrationStateCircle({
  migration,
  nxConsoleMetadata,
  isRunning,
  needsAttention,
  onClick,
}: MigrationStateCircleProps) {
  let bgColor = '';
  let textColor = '';
  let Icon = ClockIcon;

  // Check if this migration is in the completed migrations
  const completedMigration =
    nxConsoleMetadata.completedMigrations?.[migration.id];

  const isSkipped = completedMigration?.type === 'skipped';
  const isError = completedMigration?.type === 'failed';
  const isSuccess = completedMigration?.type === 'successful';

  if (isSkipped) {
    bgColor = 'bg-slate-300';
    textColor = 'text-slate-700';
    Icon = MinusIcon;
  } else if (isError) {
    bgColor = 'bg-red-500';
    textColor = 'text-white';
    Icon = ExclamationCircleIcon;
  } else if (isRunning) {
    bgColor = 'bg-blue-500';
    textColor = 'text-white';
    Icon = ClockIcon;
  } else if (isSuccess) {
    bgColor = 'bg-green-500';
    textColor = 'text-white';
    Icon = CheckCircleIcon;
  } else {
    // Future migration (none of the states above)
    bgColor = 'bg-slate-300';
    textColor = 'text-slate-700';
    Icon = ClockIcon;
  }

  return (
    <div
      className={twMerge(
        `absolute left-0 top-0 flex h-8 w-8 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full ${bgColor} ${textColor}`,
        needsAttention ? 'animate-pulse' : ''
      )}
      onClick={onClick}
    >
      {isRunning ? (
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : (
        <Icon className="h-6 w-6" />
      )}
    </div>
  );
}
