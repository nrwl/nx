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
 * The orchestrator writes its run scratch under `.nx/migrate-runs/<run-id>/`
 * at init, before any migration runs. The v23 migration
 * `23-0-0-add-migrate-runs-to-git-ignore` adds `.nx/migrate-runs` to
 * `.gitignore`, so this applies its body inline against an `FsTree` first;
 * otherwise the run's commits would absorb the scratch into the user-visible
 * diff. It commits nothing: the orchestrator applies it before its init
 * checkpoint, which carries the edit when commits are on and the checkpoint
 * succeeds.
 *
 * A planned v23 migration means the entry is still owed, so it applies
 * whatever the installed version, and that migration then changes nothing in
 * its own step. When the v23 migration is not planned and nx is at v23 or
 * later, the user is already past v23. They had the entry historically; if it
 * is gone, that is a conscious removal we respect.
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
