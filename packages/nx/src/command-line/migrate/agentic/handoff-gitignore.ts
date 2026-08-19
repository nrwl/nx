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
 * `.nx/migrate-runs/<run-id>/`: handoff files in both cases, plus the durable
 * run state and its plan snapshots for the orchestrator. The v23 migration
 * `23-0-0-add-migrate-runs-to-git-ignore` adds `.nx/migrate-runs` to
 * `.gitignore`; in its declared slot (typically late) earlier per-migration
 * commits would absorb the scratch into the user-visible diff.
 *
 * Two paths cover the leak, with no overlap:
 *
 *   1. HOIST: `sortMigrations`, which `executeMigrations` applies, sorts the
 *      v23 migration to position 0 when it is in the queue, so it runs first
 *      through the normal runner with its own log line and commit. A
 *      single-migration worker run needs no hoisting: the requested migration
 *      is the entire queue.
 *
 *   2. INLINE FALLBACK, this function. When the migration is NOT in the queue
 *      AND the highest target version is < v23 (intra-pre-v23 `--agentic`
 *      run) it will never run, so apply its body inline against an `FsTree`
 *      and commit it as a standalone preflight commit (or leave it in the
 *      working tree under `--no-create-commits`).
 *
 * Not in the queue AND target >= v23 means the user is already past v23. They
 * had the entry historically; if it is gone, that is a conscious removal we
 * respect.
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
   * Apply the entry even when the hoisted migration is in the plan. The
   * classic loop can defer to that migration because its run scratch appears
   * only after migration 1 has run; the orchestrator creates its run dir at
   * init, before any migration, so it needs the entry immediately. A planned
   * migration also means the missing entry is not a conscious removal, so the
   * v23 cutoff does not apply.
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
      // The queue runs it itself: hoisted to the front by the sort comparator
      // in a full run, or as the single requested migration in a worker run.
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
