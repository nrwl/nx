/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
// nx-ignore-next-line
import { FileChange } from 'nx/src/devkit-exports';
/* eslint-enable @nx/enforce-module-boundaries */
import { useRef, useState } from 'react';
import { MigrationList } from './migration-list';
import { AutomaticMigration } from './automatic-migration';
import { MigrationSettingsPanel } from './migration-settings-panel';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { Tooltip } from '@nx/graph/ui-tooltips';

export interface MigrateUIProps {
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
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

export function MigrateUI(props: MigrateUIProps) {
  const [squashCommits, setSquashCommits] = useState(true);

  const [createCommits, setCreateCommits] = useState(true);
  const [automaticMode, setAutomaticMode] = useState(true);
  const [commitPrefix, setCommitPrefix] = useState('');

  return (
    <div className="p-2">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold">
          Migrating to {props.nxConsoleMetadata.targetVersion}
        </h2>
        <MigrationSettingsPanel
          automaticMode={automaticMode}
          setAutomaticMode={setAutomaticMode}
          createCommits={createCommits}
          setCreateCommits={setCreateCommits}
          commitPrefix={commitPrefix}
          setCommitPrefix={setCommitPrefix}
        />
      </div>
      {automaticMode ? (
        <AutomaticMigration
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
      ) : (
        <MigrationList
          migrations={props.migrations}
          nxConsoleMetadata={props.nxConsoleMetadata}
          onRunMigration={(migration) =>
            props.onRunMigration(migration, { createCommits })
          }
          onRunMany={(migrations) =>
            props.onRunMany(migrations, {
              createCommits,
              commitPrefix,
            })
          }
          onFileClick={props.onFileClick}
          onViewImplementation={(migration) =>
            props.onViewImplementation(migration)
          }
          onViewDocumentation={(migration) =>
            props.onViewDocumentation(migration)
          }
        />
      )}
      <div className="sticky bottom-0 flex justify-end gap-2 bg-white py-4 dark:bg-slate-900">
        <div className="flex gap-2">
          <button
            onClick={props.onCancel}
            type="button"
            className="flex w-full items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
          >
            Cancel
          </button>
          <div className="flex">
            <button
              onClick={() => props.onFinish(squashCommits)}
              type="button"
              className="whitespace-nowrap rounded-l-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 dark:border-blue-700 dark:bg-blue-600 dark:text-white hover:dark:bg-blue-700"
            >
              {squashCommits
                ? 'Finish (squash commits)'
                : 'Finish without squashing commits'}
            </button>
            <Tooltip
              placement="top"
              openAction="click"
              content={
                <span
                  onClick={() => {
                    setSquashCommits(!squashCommits);
                  }}
                  className="cursor-pointer "
                >
                  {squashCommits
                    ? 'Finish without squashing commits'
                    : 'Finish (squash commits)'}
                </span>
              }
            >
              <button
                type="button"
                className="flex items-center rounded-r-md border border-l-0 border-blue-500 bg-blue-500 px-2 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:border-blue-700 dark:bg-blue-700 dark:text-white hover:dark:bg-blue-800"
              >
                <ChevronDownIcon className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MigrateUI;
