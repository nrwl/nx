/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
// nx-ignore-next-line
import { FileChange } from 'nx/src/devkit-exports';
/* eslint-enable @nx/enforce-module-boundaries */
import { useState } from 'react';
import { MigrationList } from './migration-list';
import { AutomaticMigration } from './automatic-migration';

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
    }
  ) => void;
  onSkipMigration: (migration: MigrationDetailsWithId) => void;
  onCancel: () => void;
  onFinish: (squashCommits: boolean) => void;
  onFileClick: (file: Omit<FileChange, 'content'>) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
}

export function MigrateUI(props: MigrateUIProps) {
  const [createCommits, setCreateCommits] = useState(true);
  const [squashCommits, setSquashCommits] = useState(true);

  const [automaticMode, setAutomaticMode] = useState(true);

  return (
    <div className="p-2">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold">
          Migrating to {props.nxConsoleMetadata.targetVersion}
        </h2>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            onClick={() => setAutomaticMode(!automaticMode)}
          >
            {automaticMode
              ? 'Switch to manual mode'
              : 'Switch to automatic mode'}
          </button>
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
        />
      ) : (
        <MigrationList
          migrations={props.migrations}
          nxConsoleMetadata={props.nxConsoleMetadata}
          onRunMigration={(migration) =>
            props.onRunMigration(migration, { createCommits })
          }
          onRunMany={(migrations) =>
            props.onRunMany(migrations, { createCommits })
          }
          onFileClick={props.onFileClick}
          onViewImplementation={(migration) =>
            props.onViewImplementation(migration)
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
  );
}

export default MigrateUI;
