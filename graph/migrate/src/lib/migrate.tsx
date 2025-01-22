/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { GeneratedMigrationDetails } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import { FileChange } from 'nx/src/devkit-exports';
/* eslint-enable @nx/enforce-module-boundaries */
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { Pill } from '@nx/graph-internal/ui-project-details';
import { useCallback, useMemo, useState } from 'react';

export type SuccessfulMigration = {
  type: 'successful';
  name: string;
  changedFiles: FileChange[];
};

export type FailedMigration = {
  type: 'failed';
  name: string;
  error: string;
};

export type NxConsoleMigrateMetadata = {
  completedMigrations?: Record<string, SuccessfulMigration | FailedMigration>;
  runningMigrations?: string[];
  initialGitRef?: {
    ref: string;
    subject: string;
  };
  confirmedPackageUpdates?: boolean;
  targetVersion?: string;
};

export interface MigrateUIProps {
  migrations: GeneratedMigrationDetails[];
  nxConsoleMetadata: NxConsoleMigrateMetadata;
  onRunMigration: (
    migration: GeneratedMigrationDetails,
    configuration: {
      createCommits: boolean;
    }
  ) => void;
  onRunMany: (
    migrations: GeneratedMigrationDetails[],
    configuration: {
      createCommits: boolean;
    }
  ) => void;
  onCancel: () => void;
  onFinish: (squashCommits: boolean) => void;
}

export function MigrateUI(props: MigrateUIProps) {
  const [createCommits, setCreateCommits] = useState(true);
  const [squashCommits, setSquashCommits] = useState(true);

  const [selectedMigrations, setSelectedMigrations] = useState<
    Record<string, boolean>
  >(
    props.migrations.reduce((acc, migration) => {
      acc[migration.name] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const numberSelected = useMemo(
    () =>
      Object.values(selectedMigrations).filter((selected) => selected).length,
    [selectedMigrations]
  );

  const anySelected = useMemo(
    () =>
      Object.values(selectedMigrations).filter((selected) => selected).length >
      0,
    [selectedMigrations]
  );

  const allSelected = useMemo(
    () => props.migrations.length === numberSelected,
    [props.migrations, numberSelected]
  );

  const numberFailed = useMemo(
    () =>
      Object.values(props.nxConsoleMetadata.completedMigrations ?? {}).filter(
        (migration) => migration.type === 'failed'
      ).length,
    [props.nxConsoleMetadata.completedMigrations]
  );

  const handleHeaderCheckboxClick = () => {
    const newSelectedState = !anySelected;
    setSelectedMigrations(
      Object.keys(selectedMigrations).reduce((acc, migrationName) => {
        acc[migrationName] = newSelectedState;
        return acc;
      }, {} as Record<string, boolean>)
    );
  };

  const selectAllCheckboxRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (!el) return;
      el.checked = allSelected;
      el.indeterminate = anySelected && !allSelected;
    },
    [allSelected, anySelected]
  );

  const handleRunMany = () => {
    props.onRunMany(
      props.migrations.filter(
        (migration) => selectedMigrations[migration.name]
      ),
      {
        createCommits,
      }
    );
  };

  const handleRerunFailed = () => {
    props.onRunMany(
      props.migrations.filter(
        (migration) =>
          props.nxConsoleMetadata.completedMigrations?.[migration.name]
            ?.type === 'failed'
      ),
      {
        createCommits,
      }
    );
  };

  return (
    <div className="p-2">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold">
          Migrating to {props.nxConsoleMetadata.targetVersion}
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="create-commits">Create commits</label>
          <input
            checked={createCommits}
            onChange={(e) => setCreateCommits((e.target as any).checked)}
            id="create-commits"
            name="create-commits"
            value="create-commits"
            type="checkbox"
            className={`h-4 w-4`}
          />
        </div>
      </div>
      {/* Migration List */}
      <div
        className={`my-2 gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700/60`}
      >
        <div className="flex h-4 w-4 w-full items-center gap-4">
          <input
            ref={selectAllCheckboxRef}
            onClick={handleHeaderCheckboxClick}
            id="select-all"
            name="select-all"
            value="select-all"
            type="checkbox"
            className={`h-4 w-4 accent-blue-500 dark:accent-sky-500`}
          />
          <label htmlFor="select-all">
            {allSelected || anySelected
              ? `${numberSelected} selected`
              : 'Select all'}
          </label>
          {anySelected && (
            <button
              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
              onClick={handleRunMany}
            >
              <PlayIcon className="h-5 w-5"></PlayIcon>
              Run selected migrations
            </button>
          )}
          {numberFailed > 0 && (
            <button
              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
              onClick={handleRerunFailed}
            >
              <PlayIcon className="h-5 w-5"></PlayIcon>
              Rerun failed migrations
            </button>
          )}
        </div>
      </div>
      <div>
        {props.migrations.map((migration) => {
          const migrationResult =
            props.nxConsoleMetadata.completedMigrations?.[migration.name];
          const succeeded = migrationResult?.type === 'successful';
          const failed = migrationResult?.type === 'failed';
          const inProgress =
            props.nxConsoleMetadata.runningMigrations?.includes(migration.name);

          const madeChanges =
            succeeded && !!migrationResult?.changedFiles.length;

          return (
            <div
              key={migration.name}
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
                  <div className="h-4 w-4">
                    <input
                      checked={selectedMigrations[migration.name]}
                      onChange={(e) =>
                        setSelectedMigrations({
                          ...selectedMigrations,
                          [migration.name]: (e.target as any).checked,
                        })
                      }
                      id={migration.name}
                      name={migration.name}
                      value={migration.name}
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
                            succeeded
                              ? 'text-green-600 dark:text-green-500'
                              : 'hidden'
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
                    <span className={`text-sm`}>{migration.description}</span>
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
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {' '}
                  {succeeded && !madeChanges && (
                    <Pill text="No changes made" color="green" />
                  )}
                  {succeeded && madeChanges && (
                    <Pill
                      text={`${migrationResult?.changedFiles.length} changes`}
                      color="green"
                    />
                  )}
                  <span
                    className={`rounded-md p-1 text-sm ring-1 ring-inset transition-colors ${
                      succeeded
                        ? 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-500 dark:ring-green-900/30 dark:hover:bg-green-900/30'
                        : failed
                        ? 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-500 dark:ring-red-900/30 dark:hover:bg-red-900/30'
                        : 'bg-inherit text-slate-600 ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    {inProgress ? (
                      <ArrowPathIcon
                        className="h-6 w-6 animate-spin cursor-not-allowed text-blue-500"
                        aria-label="Migration in progress"
                      />
                    ) : !succeeded && !failed ? (
                      <PlayIcon
                        onClick={() =>
                          props.onRunMigration(migration, {
                            createCommits,
                          })
                        }
                        className="h-6 w-6 !cursor-pointer"
                        aria-label="Run migration"
                      />
                    ) : (
                      <ArrowPathIcon
                        onClick={() =>
                          props.onRunMigration(migration, {
                            createCommits,
                          })
                        }
                        className="h-6 w-6 !cursor-pointer"
                        aria-label="Rerun migration"
                      />
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="sticky bottom-0 flex justify-end gap-2 bg-white py-4 dark:bg-slate-900">
          <div className="flex gap-2">
            <button
              onClick={props.onCancel}
              type="button"
              className="flex w-full items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={() => props.onFinish(squashCommits)}
              type="button"
              className="flex w-full items-center rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 dark:border-blue-700 dark:bg-blue-600 dark:text-white hover:dark:bg-blue-700"
            >
              Finish
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <label htmlFor="create-commits">Squash commits</label>
          <input
            checked={squashCommits}
            onChange={(e) => setSquashCommits((e.target as any).checked)}
            id="squash-commits"
            name="squash-commits"
            value="squash-commits"
            type="checkbox"
            className={`h-4 w-4`}
          />
        </div>
      </div>
    </div>
  );
}

export default MigrateUI;
