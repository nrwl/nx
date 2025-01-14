/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationsJsonEntry } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import { CheckCircleIcon, PlayIcon } from '@heroicons/react/24/outline';

export interface MigrateUIProps {
  migrations: MigrationsJsonEntry[];
  successfulMigrations: string[];
  onRunMigration: (migration: MigrationsJsonEntry) => void;
}

export function MigrateUI(props: MigrateUIProps) {
  return (
    <div>
      {props.migrations.map((migration) => {
        const done = props.successfulMigrations.includes(migration.name);
        return (
          <div
            key={migration.name}
            className={`m-2 gap-2 rounded-md border p-2 transition-colors ${
              done
                ? 'border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-900/10'
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
                      done
                        ? 'accent-green-600 dark:accent-green-500'
                        : 'accent-blue-500 dark:accent-sky-500'
                    }`}
                  />
                </div>
                <div
                  className={`gap-2 ${
                    done
                      ? 'text-green-600 dark:text-green-500'
                      : 'text-gray-500'
                  }`}
                >
                  <div className={`flex items-center gap-2 `}>
                    <div>{migration.name}</div>
                    <CheckCircleIcon
                      className={`h-4 w-4 ${
                        done ? 'text-green-600 dark:text-green-500' : 'hidden'
                      }`}
                    />
                  </div>
                  <span className={`text-sm`}>{migration.description}</span>
                </div>
              </div>

              <span
                className={`rounded-md p-1 text-sm ring-1 ring-inset transition-colors ${
                  done
                    ? 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-500 dark:ring-green-900/30 dark:hover:bg-green-900/30'
                    : 'bg-inherit text-slate-600 ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60'
                }`}
              >
                <PlayIcon
                  onClick={() => props.onRunMigration(migration)}
                  className="h-6 w-6 !cursor-pointer"
                  aria-label={done ? 'Run migration again' : 'Run migration'}
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
