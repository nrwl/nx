/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { GeneratedMigrationDetails } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { Pill } from '@nx/graph-internal/ui-project-details';
import { useState } from 'react';

export type NxConsoleMigrateMetadata = {
  successfulMigrations?: { name: string; changes: string[] }[];
  failedMigrations?: { name: string; error: unknown }[];
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
  onCancel: () => void;
  onFinish: () => void;
}

export function MigrateUI(props: MigrateUIProps) {
  const [createCommits, setCreateCommits] = useState(true);

  return (
    <div className="p-2">
      <div className="flex items-center justify-end gap-2">
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
      <div>
        {props.migrations.map((migration) => {
          const successfulMigration =
            props.nxConsoleMetadata.successfulMigrations?.find(
              (successfulMigration) =>
                successfulMigration.name === migration.name
            );
          const succeeded = !!successfulMigration;
          const madeChanges = !!successfulMigration?.changes.length;

          const failed = !!props.nxConsoleMetadata.failedMigrations?.find(
            (failedMigration) => failedMigration.name === migration.name
          );
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
                  <div className="relative h-4 w-4">
                    <input
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
                  <span
                    className={`rounded-md p-1 text-sm ring-1 ring-inset transition-colors ${
                      succeeded
                        ? 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-500 dark:ring-green-900/30 dark:hover:bg-green-900/30'
                        : failed
                        ? 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-500 dark:ring-red-900/30 dark:hover:bg-red-900/30'
                        : 'bg-inherit text-slate-600 ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    {!succeeded && !failed ? (
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
        <div className="sticky bottom-0 flex justify-end gap-2 bg-white p-4 dark:bg-slate-900">
          <div className="flex gap-2">
            <button
              onClick={props.onCancel}
              type="button"
              className="flex w-full items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={props.onFinish}
              type="button"
              className="flex w-full items-center rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 dark:border-blue-700 dark:bg-blue-600 dark:text-white hover:dark:bg-blue-700"
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MigrateUI;
