import { major } from 'semver';
import * as pc from 'picocolors';
import addMigrateRunsToGitIgnore from '../../../migrations/update-23-0-0/add-migrate-runs-to-git-ignore';
import { FsTree, flushChanges } from '../../../generators/tree';
import {
  hasUncommittedChanges,
  tryCommitChanges,
} from '../../../utils/git-utils';
import { logger } from '../../../utils/logger';
import {
  isHandoffGitignoreMigration,
  MIGRATE_RUNS_RELATIVE_DIR,
} from './types';

/**
 * Both the agentic runner and the orchestrator write per-run scratch under
 * `.nx/migrate-runs/<run-id>/`: handoff and prompt files in both cases, plus
 * the durable run state and its plan snapshots for the orchestrator. The v23
 * migration `23-0-0-add-migrate-runs-to-git-ignore` adds `.nx/migrate-runs` to
 * `.gitignore`, but the scratch exists before that migration runs, so earlier
 * commits would absorb it into the user-visible diff. Its two callers use this
 * function to add the entry before that can happen:
 *
 *   1. Orchestrator init calls it with `applyWhenPlanned` and no standalone
 *      commit, before it creates the run dir. Its checkpoint commit carries the
 *      edit when commits are on and the checkpoint succeeds. A planned v23
 *      migration then changes nothing in its own step.
 *
 *   2. A single-migration worker run with an agent defers to the requested
 *      migration when it is the v23 one. Otherwise, below v23, it applies the
 *      entry and commits it as a standalone preflight commit (or leaves it in
 *      the working tree under `--no-create-commits`).
 *
 * When the v23 migration is not planned and nx is at v23 or later, the user is
 * already past v23. They had the entry historically; if it is gone, that is a
 * conscious removal we respect.
 */
export async function applyAgenticHandoffGitignoreFallback({
  migrations,
  installedNxVersion,
  effectiveCreateCommits,
  commitPrefix,
  root,
  applyWhenPlanned = false,
  commitStandalone = true,
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
  effectiveCreateCommits: boolean;
  commitPrefix: string;
  root: string;
  /**
   * Apply the entry even when the v23 migration is in the plan. The
   * orchestrator creates its run dir at init, before any migration runs, so
   * it can't defer to that migration. A planned migration also means the
   * missing entry is not a conscious removal, so the v23 cutoff does not
   * apply.
   */
  applyWhenPlanned?: boolean;
  /**
   * Commit the applied entry as its own preflight commit (the default). The
   * orchestrator suppresses this: it applies the fallback before its init
   * checkpoint so the checkpoint's `git add -A` cannot sweep in older
   * scratch, and in that ordering a standalone commit here would carry the
   * user's pre-existing changes along with the entry. The checkpoint that
   * follows captures both instead.
   */
  commitStandalone?: boolean;
}): Promise<void> {
  if (migrations.some(isHandoffGitignoreMigration)) {
    if (!applyWhenPlanned) {
      // The single-migration worker run is that migration, and it adds the
      // entry itself.
      return;
    }
  } else if (major(installedNxVersion) >= 23) {
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

  if (!effectiveCreateCommits || !commitStandalone) return;
  if (!hasUncommittedChanges(root)) return;

  try {
    const sha = tryCommitChanges(
      `${commitPrefix}add ${MIGRATE_RUNS_RELATIVE_DIR} to .gitignore`,
      root,
      [MIGRATE_RUNS_RELATIVE_DIR]
    );
    if (sha) {
      logger.info(pc.dim(`  Commit: ${sha}`));
    }
    // `null` return = commit landed but `git rev-parse HEAD` raced. The
    // diff cleared from the working tree; nothing more to say.
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.info(
      pc.yellow(
        `Could not create the agentic preflight commit:\n${reason}\n` +
          `The .gitignore change remains in the working tree; commit it manually or it will be absorbed into the first per-migration commit.`
      )
    );
  }
}
