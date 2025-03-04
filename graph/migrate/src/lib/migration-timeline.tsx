/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { FileChange } from '@nx/devkit';
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
// nx-ignore-next-line
import type { SuccessfulMigration } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */
import {
  ChevronUpIcon,
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState, useRef } from 'react';
import { MigrationCard, MigrationCardHandle } from './migration-card';

export interface MigrationTimelineProps {
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
  currentMigrationIndex: number;
  currentMigrationRunning?: boolean;
  currentMigrationFailed?: boolean;
  isDone?: boolean;
  onRunMigration: (migration: MigrationDetailsWithId) => void;
  onSkipMigration: (migration: MigrationDetailsWithId) => void;
  onFileClick: (
    migration: MigrationDetailsWithId,
    file: Omit<FileChange, 'content'>
  ) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
  onViewDocumentation: (migration: MigrationDetailsWithId) => void;
  onCancel?: () => void;
  onPauseResume?: () => void;
  isPaused?: boolean;
  onReviewMigration?: (migrationId: string) => void;
}

export function MigrationTimeline({
  migrations,
  nxConsoleMetadata,
  currentMigrationIndex,
  currentMigrationRunning,
  currentMigrationFailed,
  isDone,
  onRunMigration,
  onSkipMigration,
  onFileClick,
  onViewImplementation,
  onViewDocumentation,
  onCancel,
  onPauseResume,
  isPaused = false,
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
  const visibleCount = 2;
  const visiblePastMigrations = showAllPastMigrations
    ? pastMigrations
    : pastMigrations.slice(Math.max(0, pastMigrations.length - visibleCount));
  const visibleFutureMigrations = showAllFutureMigrations
    ? futureMigrations
    : futureMigrations.slice(0, visibleCount);

  const hasPastMigrationsHidden =
    pastMigrations.length > visibleCount && !showAllPastMigrations;
  const hasFutureMigrationsHidden =
    futureMigrations.length > visibleCount && !showAllFutureMigrations;

  const currentMigrationRef = useRef<MigrationCardHandle>(null);

  // Auto-expand when entering a failed migration
  useEffect(() => {
    if (currentMigrationFailed && currentMigrationRef.current) {
      currentMigrationRef.current.expand();
    }
  }, [currentMigration?.id, currentMigrationFailed]);

  const toggleMigrationExpanded = (migrationId: string) => {
    setExpandedMigrations((prev) => ({
      ...prev,
      [migrationId]: !prev[migrationId],
    }));
  };

  if (isDone) {
    return (
      <div className="flex flex-col">
        <div className="rounded-md border border-green-500 bg-green-50 p-3 text-green-600 dark:border-green-900/30 dark:bg-green-900/10 dark:text-green-500">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CheckCircleIcon className="h-6 w-6" />
            All migrations completed
          </h2>
        </div>
      </div>
    );
  }

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
        {/* Continuous timeline line that spans all migrations */}
        <div className="absolute left-10 h-full w-0.5 bg-slate-200"></div>

        {/* Timeline container */}
        <div className="flex flex-col">
          {/* Past migrations section */}
          {pastMigrations.length > 0 && (
            <>
              {hasPastMigrationsHidden && (
                <button
                  onClick={() => setShowAllPastMigrations(true)}
                  className="mb-4 flex items-center text-sm text-slate-500 hover:text-slate-700"
                >
                  <ChevronUpIcon className="mr-1 h-4 w-4" />
                  Show {pastMigrations.length -
                    visiblePastMigrations.length}{' '}
                  more
                </button>
              )}

              {visiblePastMigrations.map((migration) => (
                <div key={migration.id} className="relative mb-6 w-full">
                  <MigrationCircle
                    type="past"
                    onClick={() => toggleMigrationExpanded(migration.id)}
                  />

                  <div className="ml-6">
                    <div
                      className="flex cursor-pointer items-center"
                      onClick={() => toggleMigrationExpanded(migration.id)}
                    >
                      <span className="text-sm font-medium text-green-600">
                        {migration.name}
                      </span>
                    </div>

                    {expandedMigrations[migration.id] && (
                      <div className="mt-2 w-full rounded-md border border-slate-300 p-3">
                        <MigrationCard
                          migration={migration}
                          nxConsoleMetadata={nxConsoleMetadata}
                          onFileClick={(file) => onFileClick(migration, file)}
                          onViewImplementation={() =>
                            onViewImplementation(migration)
                          }
                          onViewDocumentation={() =>
                            onViewDocumentation(migration)
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {showAllPastMigrations && (
                <button
                  onClick={() => setShowAllPastMigrations(false)}
                  className="mb-4 flex items-center text-sm text-slate-500 hover:text-slate-700"
                >
                  <ChevronDownIcon className="mr-1 h-4 w-4" />
                  Show fewer
                </button>
              )}
            </>
          )}

          {/* Current migration */}
          <div className="relative mb-6 w-full">
            <MigrationCircle
              type="current"
              isRunning={currentMigrationRunning}
              isFailed={currentMigrationFailed}
              onClick={() => {
                if (currentMigrationRef.current) {
                  currentMigrationRef.current.toggle();
                }
              }}
            />

            <div className="ml-6">
              <div
                className="flex cursor-pointer items-center"
                onClick={() => {
                  if (currentMigrationRef.current) {
                    currentMigrationRef.current.toggle();
                  }
                }}
              >
                <span className="text-sm font-medium">
                  {currentMigration.name}
                </span>
              </div>

              <div className="mt-2 w-full rounded-md border border-slate-300 p-3">
                {/* Controls */}
                <div className="mb-4 flex gap-2">
                  {onPauseResume && (
                    <button
                      onClick={onPauseResume}
                      type="button"
                      className="flex items-center rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 dark:border-blue-700 dark:bg-blue-600 dark:text-white hover:dark:bg-blue-700"
                    >
                      {isPaused ? (
                        <PlayIcon className="mr-2 h-4 w-4" />
                      ) : (
                        <PauseIcon className="mr-2 h-4 w-4" />
                      )}
                      {isPaused ? 'Run Migrations' : 'Pause Migrations'}
                    </button>
                  )}
                  {currentMigrationFailed && (
                    <>
                      <button
                        onClick={() => onRunMigration(currentMigration)}
                        type="button"
                        className="flex items-center rounded-md border border-red-500 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 dark:border-red-700 dark:bg-red-600 dark:text-white hover:dark:bg-red-700"
                      >
                        Rerun
                      </button>
                      <button
                        onClick={() => onSkipMigration(currentMigration)}
                        type="button"
                        className="flex items-center rounded-md border border-slate-500 bg-slate-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-600 dark:border-slate-600 dark:bg-slate-600 dark:text-white hover:dark:bg-slate-700"
                      >
                        Skip
                      </button>
                    </>
                  )}
                  {!currentMigrationFailed &&
                    onReviewMigration &&
                    nxConsoleMetadata.completedMigrations?.[currentMigration.id]
                      ?.type === 'successful' &&
                    (
                      nxConsoleMetadata.completedMigrations?.[
                        currentMigration.id
                      ] as SuccessfulMigration
                    )?.changedFiles?.length > 0 && (
                      <button
                        onClick={() => onReviewMigration(currentMigration.id)}
                        type="button"
                        className="flex items-center rounded-md border border-green-500 bg-green-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-600 dark:border-green-700 dark:bg-green-600 dark:text-white hover:dark:bg-green-700"
                      >
                        Approve Changes
                      </button>
                    )}
                </div>

                {/* Migration Card */}
                <MigrationCard
                  ref={currentMigrationRef}
                  migration={currentMigration}
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
              </div>
            </div>
          </div>

          {/* Future migrations */}
          {futureMigrations.length > 0 && (
            <>
              {visibleFutureMigrations.map((migration) => (
                <div key={migration.id} className="relative mb-6 w-full">
                  <MigrationCircle
                    type="future"
                    onClick={() => toggleMigrationExpanded(migration.id)}
                  />

                  <div className="ml-6">
                    <div
                      className="flex cursor-pointer items-center"
                      onClick={() => toggleMigrationExpanded(migration.id)}
                    >
                      <span className="text-sm font-medium text-slate-600">
                        {migration.name}
                      </span>
                    </div>

                    {expandedMigrations[migration.id] && (
                      <div className="mt-2 w-full rounded-md border border-slate-300 p-3">
                        <MigrationCard
                          migration={migration}
                          nxConsoleMetadata={nxConsoleMetadata}
                          onFileClick={(file) => onFileClick(migration, file)}
                          onViewImplementation={() =>
                            onViewImplementation(migration)
                          }
                          onViewDocumentation={() =>
                            onViewDocumentation(migration)
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {hasFutureMigrationsHidden && (
                <div
                  key="show-future-migrations"
                  className="relative mb-6 w-full"
                >
                  <MigrationCircle
                    type="button-down"
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
                  className="relative mb-6 w-full"
                >
                  <MigrationCircle
                    type="button-up"
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

interface MigrationCircleProps {
  type: 'past' | 'current' | 'future' | 'button-down' | 'button-up';
  isRunning?: boolean;
  isFailed?: boolean;
  onClick: () => void;
}

function MigrationCircle({
  type,
  isRunning,
  isFailed,
  onClick,
}: MigrationCircleProps) {
  let bgColor = '';
  let textColor = '';
  let Icon = ClockIcon;

  switch (type) {
    case 'past':
      bgColor = 'bg-green-500';
      textColor = 'text-white';
      Icon = CheckCircleIcon;
      break;
    case 'current':
      if (isFailed) {
        bgColor = 'bg-red-500';
        textColor = 'text-white';
        Icon = ExclamationCircleIcon;
      } else if (isRunning) {
        bgColor = 'bg-blue-500';
        textColor = 'text-white';
        Icon = ClockIcon;
      } else {
        bgColor = 'bg-orange-500';
        textColor = 'text-white';
        Icon = CheckCircleIcon;
      }
      break;
    case 'future':
      bgColor = 'bg-slate-300';
      textColor = 'text-slate-700';
      Icon = ClockIcon;
      break;
    case 'button-down':
      bgColor = 'bg-slate-300';
      textColor = 'text-slate-700';
      Icon = ChevronDownIcon;
      break;
    case 'button-up':
      bgColor = 'bg-slate-300';
      textColor = 'text-slate-700';
      Icon = ChevronUpIcon;
      break;
  }

  return (
    <div
      className={`absolute left-0 top-0 flex ${
        type.startsWith('button') ? 'h-6 w-6' : 'h-8 w-8'
      } -translate-x-1/2 cursor-pointer items-center justify-center rounded-full ${bgColor} ${textColor}`}
      onClick={onClick}
    >
      <Icon
        className={`${type.startsWith('button') ? 'h-4 w-4' : 'h-6 w-6'} ${
          isRunning ? 'animate-pulse' : ''
        }`}
      />
    </div>
  );
}
