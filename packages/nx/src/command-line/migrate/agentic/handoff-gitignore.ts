import { major } from 'semver';
import * as pc from 'picocolors';
import addMigrateRunsToGitIgnore from '../../../migrations/update-23-0-0/add-migrate-runs-to-git-ignore';
import { FsTree, flushChanges } from '../../../generators/tree';
import { logger } from '../../../utils/logger';
import {
  isHandoffGitignoreMigration,
  MIGRATE_RUNS_RELATIVE_DIR,
} from './types';

/**
 * Applies the v23 migration `23-0-0-add-migrate-runs-to-git-ignore` inline:
 * the orchestrator writes run scratch at init, before that migration runs, and
 * the run's commits would otherwise absorb it. Commits nothing; the init
 * checkpoint carries the edit when commits are on and the checkpoint succeeds.
 * Skipped at nx v23 or later unless the v23 migration is planned: a missing
 * entry is then a conscious removal.
 */
export async function applyAgenticHandoffGitignoreFallback({
  migrations,
  installedNxVersion,
  root,
}: {
  migrations: ReadonlyArray<{ package: string; name: string }>;
  /**
   * The version of `nx` currently installed in the workspace. After
   * `nx migrate latest` runs (the step before `--run-migrations`), this is
   * the target nx version. We use it as the v23 cutoff instead of walking
   * the migration list: any third-party plugin migration with a `23.x`
   * version is irrelevant to whether `nx` itself crossed v23.
   */
  installedNxVersion: string;
  root: string;
}): Promise<void> {
  if (
    !migrations.some(isHandoffGitignoreMigration) &&
    major(installedNxVersion) >= 23
  ) {
    // User is past v23. Respect their `.gitignore` state — if the entry
    // is missing, that's a conscious removal.
    return;
  }

  const tree = new FsTree(root, false);
  await addMigrateRunsToGitIgnore(tree);
  const changes = tree.listChanges();
  if (changes.length === 0) {
    // Migration body short-circuited (no `.gitignore`, Lerna without nx.json,
    // or the entry is already covered by an existing pattern).
    return;
  }
  flushChanges(root, changes);
  logger.info(
    pc.dim(
      `- Added ${MIGRATE_RUNS_RELATIVE_DIR} to .gitignore so this run's scratch state is ignored.`
    )
  );
}
