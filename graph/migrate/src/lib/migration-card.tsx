/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import { FileChange } from 'nx/src/devkit-exports';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CodeBracketIcon,
  ExclamationCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { Pill } from '@nx/graph-internal/ui-project-details';
import { useState } from 'react';

export function MigrationCard({
  migration,
  nxConsoleMetadata,
  isSelected,
  onSelect,
  onRunMigration,
  onFileClick,
  onViewImplementation,
  forceIsRunning,
}: {
  migration: MigrationDetailsWithId;
  nxConsoleMetadata: MigrationsJsonMetadata;
  isSelected?: boolean;
  onSelect?: (isSelected: boolean) => void;
  onRunMigration?: () => void;
  onFileClick: (file: Omit<FileChange, 'content'>) => void;
  onViewImplementation: () => void;
  forceIsRunning?: boolean;
}) {
  const migrationResult = nxConsoleMetadata.completedMigrations?.[migration.id];
  const succeeded = migrationResult?.type === 'successful';
  const failed = migrationResult?.type === 'failed';
  const inProgress = nxConsoleMetadata.runningMigrations?.includes(
    migration.id
  );

  const madeChanges = succeeded && !!migrationResult?.changedFiles.length;

  const renderSelectBox = onSelect && isSelected !== undefined;

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      key={migration.id}
      className={`my-2 gap-2 rounded-md border p-2 transition-colors ${
        succeeded
          ? 'border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-900/10'
          : failed
          ? 'border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-900/10'
          : 'border-slate-200 dark:border-slate-700/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {renderSelectBox && (
            <div className="h-4 w-4">
              <input
                checked={isSelected}
                onChange={(e) => onSelect((e.target as any).checked)}
                id={migration.id}
                name={migration.id}
                value={migration.id}
                type="checkbox"
                className={`h-4 w-4 ${
                  succeeded
                    ? 'accent-green-600 dark:accent-green-500'
                    : failed
                    ? 'accent-red-600 dark:accent-red-500'
                    : 'accent-blue-500 dark:accent-sky-500'
                }`}
              />
            </div>
          )}
          <div
            className={`flex flex-col gap-1 ${
              succeeded
                ? 'text-green-600 dark:text-green-500'
                : failed
                ? 'text-red-600 dark:text-red-500'
                : 'text-gray-500'
            }`}
          >
            <div className={`flex items-center gap-2 `}>
              <div>{migration.name}</div>
              {succeeded ? (
                <CheckCircleIcon
                  className={`h-4 w-4 ${
                    succeeded ? 'text-green-600 dark:text-green-500' : 'hidden'
                  }`}
                />
              ) : failed ? (
                <ExclamationCircleIcon
                  className={`h-4 w-4 ${
                    failed ? 'text-red-600 dark:text-red-500' : 'hidden'
                  }`}
                />
              ) : null}
            </div>
            <span className="text-sm">{migration.description}</span>
            <div className="flex gap-2">
              {migration.package && (
                <Pill
                  text={migration.package}
                  color={succeeded ? 'green' : failed ? 'red' : 'grey'}
                />
              )}
              <Pill
                text={migration.version}
                color={succeeded ? 'green' : failed ? 'red' : 'grey'}
              />
              <span
                onClick={() => onViewImplementation()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                <CodeBracketIcon className="h-4 w-4" />
                View Source
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {' '}
          {succeeded && !madeChanges && (
            <Pill text="No changes made" color="green" />
          )}
          {succeeded && madeChanges && (
            <div>
              <div
                className="cursor-pointer"
                onClick={() => {
                  setIsExpanded(!isExpanded);
                }}
              >
                <Pill
                  key="changes"
                  text={`${migrationResult?.changedFiles.length} changes`}
                  color="green"
                />
              </div>
              {isExpanded && (
                <ul className="flex flex-col gap-2">
                  {migrationResult?.changedFiles.map((file) => {
                    return (
                      <li
                        className="cursor-pointer hover:underline"
                        key={`${migration.id}-${file.path}`}
                        onClick={() => {
                          onFileClick(file);
                        }}
                      >
                        {file.path}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          {failed && (
            <div
              className="cursor-pointer"
              onClick={() => {
                setIsExpanded(!isExpanded);
              }}
            >
              <Pill text="Failed" color="red" />
            </div>
          )}
          {(onRunMigration || forceIsRunning) && (
            <span
              className={`rounded-md p-1 text-sm ring-1 ring-inset transition-colors ${
                succeeded
                  ? 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-500 dark:ring-green-900/30 dark:hover:bg-green-900/30'
                  : failed
                  ? 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-500 dark:ring-red-900/30 dark:hover:bg-red-900/30'
                  : 'bg-inherit text-slate-600 ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60'
              }`}
            >
              {inProgress || forceIsRunning ? (
                <ArrowPathIcon
                  className="h-6 w-6 animate-spin cursor-not-allowed text-blue-500"
                  aria-label="Migration in progress"
                />
              ) : !succeeded && !failed ? (
                <PlayIcon
                  onClick={onRunMigration}
                  className="h-6 w-6 !cursor-pointer"
                  aria-label="Run migration"
                />
              ) : (
                <ArrowPathIcon
                  onClick={onRunMigration}
                  className="h-6 w-6 !cursor-pointer"
                  aria-label="Rerun migration"
                />
              )}
            </span>
          )}
        </div>
      </div>
      {failed && isExpanded && (
        <div className="flex pl-8 pt-2">
          <pre>{migrationResult?.error}</pre>
        </div>
      )}
    </div>
  );
}
