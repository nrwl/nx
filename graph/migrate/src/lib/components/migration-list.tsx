/* eslint-disable @nx/enforce-module-boundaries */
import { FileChange } from 'nx/src/devkit-exports';
import { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */

import { PlayIcon } from '@heroicons/react/24/outline';
import { useCallback, useMemo, useState } from 'react';
import { MigrationCard } from './migration-card';
import type { Interpreter } from 'xstate';
import type {
  AutomaticMigrationState,
  AutomaticMigrationEvents,
} from '../state/automatic/types';

export function MigrationList(props: {
  actor: Interpreter<
    AutomaticMigrationState,
    any,
    AutomaticMigrationEvents,
    any,
    any
  >;
  migrations: MigrationDetailsWithId[];
  nxConsoleMetadata: MigrationsJsonMetadata;
  onRunMigration: (migration: MigrationDetailsWithId) => void;
  onRunMany: (migrations: MigrationDetailsWithId[]) => void;
  onFileClick: (
    migration: MigrationDetailsWithId,
    file: Omit<FileChange, 'content'>
  ) => void;
  onViewImplementation: (migration: MigrationDetailsWithId) => void;
  onViewDocumentation: (migration: MigrationDetailsWithId) => void;
}) {
  const [selectedMigrations, setSelectedMigrations] = useState<
    Record<string, boolean>
  >(
    props.migrations.reduce((acc, migration) => {
      acc[migration.id] = false;
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
      Object.keys(selectedMigrations).reduce((acc, migrationId) => {
        acc[migrationId] = newSelectedState;
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
      props.migrations.filter((migration) => selectedMigrations[migration.id])
    );
  };

  const handleRerunFailed = () => {
    props.onRunMany(
      props.migrations.filter(
        (migration) =>
          props.nxConsoleMetadata.completedMigrations?.[migration.id]?.type ===
          'failed'
      )
    );
  };

  return (
    <>
      <div
        className={`my-2 gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700/60`}
      >
        <div className="flex h-4 w-full items-center gap-4">
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
        {props.migrations.map((migration) => (
          <MigrationCard
            actor={props.actor}
            key={migration.id}
            migration={migration}
            nxConsoleMetadata={props.nxConsoleMetadata}
            isSelected={selectedMigrations[migration.id]}
            onSelect={(isSelected) =>
              setSelectedMigrations({
                ...selectedMigrations,
                [migration.id]: isSelected,
              })
            }
            onRunMigration={() => props.onRunMigration(migration)}
            onViewImplementation={() => {
              props.onViewImplementation(migration);
            }}
            onViewDocumentation={() => {
              props.onViewDocumentation(migration);
            }}
            onFileClick={(file) => {
              props.onFileClick(migration, file);
            }}
          />
        ))}
      </div>
    </>
  );
}
