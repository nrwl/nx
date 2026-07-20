import { lt } from 'semver';
import { isHandoffGitignoreMigration } from './agentic/handoff-gitignore';
import { normalizeVersion } from './version-utils';

interface SortableMigration {
  package: string;
  name: string;
  version: string;
}

/**
 * Orders the migrations to run. Shared by the classic `executeMigrations` loop
 * and the orchestrator so both apply migrations in the same order. Sorts in
 * place (like `Array.prototype.sort`) and returns the same array.
 *
 * `hoistHandoffGitignore` is set for runs that write scratch under
 * `.nx/migrate-runs` (agentic and orchestrated); see
 * `agentic/handoff-gitignore.ts` for why the v23 gitignore migration must run
 * first in those runs.
 */
export function sortMigrations<T extends SortableMigration>(
  migrations: T[],
  opts: { hoistHandoffGitignore: boolean }
): T[] {
  return migrations.sort((a, b) => {
    // When hoisting is enabled, hoist the v23 migration that ignores
    // `.nx/migrate-runs` to position 0 so its .gitignore update lands
    // before any per-migration commit absorbs the run's handoff scratch.
    // See `agentic/handoff-gitignore.ts` for the full rationale and the
    // inline-fallback path that covers intra-pre-v23 agentic runs.
    if (opts.hoistHandoffGitignore) {
      if (isHandoffGitignoreMigration(a)) return -1;
      if (isHandoffGitignoreMigration(b)) return 1;
    }

    // special case for the split configuration migration to run first
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
