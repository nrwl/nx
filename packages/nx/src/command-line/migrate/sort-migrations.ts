import { lt } from 'semver';
import { normalizeVersion } from './version-utils';

interface SortableMigration {
  package: string;
  name: string;
  version: string;
}

// Run before all other migrations.
const runFirstMigrations: Array<{ package?: string; name: string }> = [
  { name: '15-7-0-split-configuration-into-project-json-files' },
  // Declares `@nx/cypress`, which `@nx/storybook` no longer installs, before
  // migrations that build the project graph load `@nx/cypress/plugin`.
  {
    package: '@nx/storybook',
    name: 'update-24-1-0-add-nx-cypress-dependency',
  },
];

export function isRunFirstMigration(migration: SortableMigration): boolean {
  return runFirstMigrations.some(
    (m) =>
      m.name === migration.name &&
      (m.package === undefined || m.package === migration.package)
  );
}

/**
 * Sorts in place (like `Array.prototype.sort`) and returns the same array.
 */
export function sortMigrations<T extends SortableMigration>(
  migrations: T[]
): T[] {
  return migrations.sort((a, b) => {
    const aRunsFirst = isRunFirstMigration(a);
    if (aRunsFirst !== isRunFirstMigration(b)) {
      return aRunsFirst ? -1 : 1;
    }

    return lt(normalizeVersion(a.version), normalizeVersion(b.version))
      ? -1
      : 1;
  });
}
