/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationsJsonEntry } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */

export interface MigrateUIProps {
  migrations: MigrationsJsonEntry[];
  onRunMigration: (migration: MigrationsJsonEntry) => void;
}

export function MigrateUI(props: MigrateUIProps) {
  return (
    <div>
      {props.migrations.map((migration) => {
        return (
          <div>
            <h2>{migration.description}</h2>
            <button onClick={() => props.onRunMigration(migration)}>
              Run Migration
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default MigrateUI;
