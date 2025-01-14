/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { PlayIcon } from '@heroicons/react/24/outline';
import type { MigrationsJsonEntry } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */

type ExtendedMigrationsJsonEntry = MigrationsJsonEntry & {
  name: string;
};
export interface MigrateUIProps {
  migrations: ExtendedMigrationsJsonEntry[];
  onRunMigration: (migration: ExtendedMigrationsJsonEntry) => void;
}

export function MigrateUI(props: MigrateUIProps) {
  return (
    <div>
      {props.migrations.map((migration) => {
        return (
          <div className="m-2  gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700/60 ">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <input
                  id={migration.name}
                  name={migration.name}
                  value={migration.name}
                  type="checkbox"
                  className="h-4 w-4 accent-blue-500 dark:accent-sky-500"
                  // onChange={(event) => checkChanged(event.target.checked)}
                  // checked={checked}
                  // disabled={disabled}
                />
                <div>
                  <div>{migration.name}</div>
                  <span className="text-gray-500">{migration.description}</span>
                </div>
              </div>

              <span className="rounded-md bg-inherit p-1 text-sm text-slate-600 ring-1 ring-inset ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60">
                <PlayIcon
                  onClick={() => props.onRunMigration(migration)}
                  className="h-6 w-6 !cursor-pointer"
                />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MigrateUI;
