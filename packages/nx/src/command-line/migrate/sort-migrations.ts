import { lt } from 'semver';
import { normalizeVersion } from './version-utils';

interface SortableMigration {
  package: string;
  name: string;
  version: string;
}

/**
 * Sorts in place (like `Array.prototype.sort`) and returns the same array.
 */
export function sortMigrations<T extends SortableMigration>(
  migrations: T[]
): T[] {
  return migrations.sort((a, b) => {
    if (a.name === '15-7-0-split-configuration-into-project-json-files') {
      return -1;
    }
    if (b.name === '15-7-0-split-configuration-into-project-json-files') {
      return 1;
    }

    return lt(normalizeVersion(a.version), normalizeVersion(b.version))
      ? -1
      : 1;
  });
}
