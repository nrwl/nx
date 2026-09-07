import { lt } from 'semver';
import { isHandoffGitignoreMigration } from './agentic/types';
import { normalizeVersion } from './version-utils';

interface SortableMigration {
  package: string;
  name: string;
  version: string;
}

/**
 * Sorts in place (like `Array.prototype.sort`) and returns the same array.
 *
 * `hoistHandoffGitignore` is set for agentic runs, which write scratch under
 * `.nx/migrate-runs`; see `agentic/handoff-gitignore.ts` for why the v23
 * gitignore migration must run first there.
 */
export function sortMigrations<T extends SortableMigration>(
  migrations: T[],
  opts: { hoistHandoffGitignore: boolean }
): T[] {
  return migrations.sort((a, b) => {
    if (opts.hoistHandoffGitignore) {
      if (isHandoffGitignoreMigration(a)) return -1;
      if (isHandoffGitignoreMigration(b)) return 1;
    }

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
