/* eslint-disable @nx/enforce-module-boundaries */
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
import { FileChange } from 'nx/src/devkit-exports';
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */

import {
  ArrowPathIcon,
  CodeBracketIcon,
  ExclamationCircleIcon,
  ListBulletIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { Pill } from '@nx/graph-internal/ui-project-details';
import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface MigrationCardHandle {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
}

export const MigrationCard = forwardRef<
  MigrationCardHandle,
  {
    migration: MigrationDetailsWithId;
    nxConsoleMetadata: MigrationsJsonMetadata;
    isSelected?: boolean;
    onSelect?: (isSelected: boolean) => void;
    onRunMigration?: () => void;
    onFileClick: (file: Omit<FileChange, 'content'>) => void;
    onViewImplementation: () => void;
    onViewDocumentation: () => void;
    forceIsRunning?: boolean;
    isExpanded?: boolean;
  }
>(function MigrationCard(
  {
    migration,
    nxConsoleMetadata,
    isSelected,
    onSelect,
    onRunMigration,
    onFileClick,
    onViewImplementation,
    onViewDocumentation,
    forceIsRunning,
    isExpanded: isExpandedProp,
  },
  ref
) {
  const [isExpanded, setIsExpanded] = useState(isExpandedProp ?? false);

  useImperativeHandle(
    ref,
    () => ({
      expand: () => setIsExpanded(true),
      collapse: () => setIsExpanded(false),
      toggle: () => setIsExpanded((prev) => !prev),
    }),
    []
  );

  useEffect(() => {
    if (isExpandedProp !== undefined) {
      setIsExpanded(isExpandedProp);
    }
  }, [isExpandedProp]);

  const migrationResult = nxConsoleMetadata.completedMigrations?.[migration.id];
  const succeeded = migrationResult?.type === 'successful';
  const failed = migrationResult?.type === 'failed';
  const skipped = migrationResult?.type === 'skipped';
  const inProgress = nxConsoleMetadata.runningMigrations?.includes(
    migration.id
  );

  const madeChanges = succeeded && !!migrationResult?.changedFiles.length;

  const renderSelectBox = onSelect && isSelected !== undefined;

  const isNxMigration =
    migration.package.startsWith('@nx') || migration.package.startsWith('nx');

  return (
    <div
      key={migration.id}
      className={`gap-2 rounded-md p-2 transition-colors`}
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
          <div className={`flex flex-col gap-1`}>
            <div
              className={`flex items-center gap-2 ${
                isNxMigration ? 'cursor-pointer gap-1 hover:underline' : ''
              }`}
              onClick={() => {
                if (isNxMigration) {
                  onViewDocumentation();
                }
              }}
            >
              {/* <div>{migration.name}</div>
              {isNxMigration && (
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              )} */}
            </div>
            <span className="mb-2 text-sm">{migration.description}</span>
            <div className="flex gap-2">
              {migration.package && (
                <Pill
                  text={`${migration.package}: ${migration.version}`}
                  color={'grey'}
                />
              )}
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
            </div>
          )}
          {failed && (
            <div>
              <Pill text="Failed" color="red" />
            </div>
          )}
          {skipped && (
            <div>
              <Pill text="Skipped" color="grey" />
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
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => onViewImplementation()}
          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
        >
          <CodeBracketIcon className="h-4 w-4" />
          View Source
        </button>
        {failed && (
          <button
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <ExclamationCircleIcon className="h-4 w-4" />
            {isExpanded ? 'Hide Errors' : 'View Errors'}
          </button>
        )}
        {succeeded && madeChanges && (
          <button
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <ListBulletIcon className="h-4 w-4" />
            {isExpanded ? 'Hide Changes' : 'View Changes'}
          </button>
        )}
      </div>
      <AnimatePresence>
        {failed && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: isExpanded ? 'auto' : 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex overflow-hidden pt-2"
          >
            <pre>{migrationResult?.error}</pre>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {succeeded && madeChanges && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: isExpanded ? 'auto' : 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="my-2 border-t border-slate-200 dark:border-slate-700/60"></div>
            <span className="pb-2 text-sm font-bold">File Changes</span>
            <ul className="flex flex-col gap-2">
              {migrationResult?.changedFiles.map((file) => {
                return (
                  <li
                    className="cursor-pointer text-sm hover:underline"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
