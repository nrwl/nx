import * as pc from 'picocolors';
import {
  commitChanges,
  getLatestCommitSha,
  hasUncommittedChanges,
} from '../../utils/git-utils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';

/**
 * Commit lifecycle helpers for `nx migrate --run-migrations`.
 *
 * Both helpers share a non-obvious invariant worth documenting once: when
 * `commitChanges` is called with a `directory` argument it swallows `git
 * commit` failures (missing `user.email`, hook rejection, "nothing to commit")
 * and returns the existing HEAD unchanged. To detect whether a new commit
 * actually landed, compare HEAD before vs after the call instead of relying
 * on the return value.
 */

/**
 * Creates a per-migration commit when `shouldCreateCommits` is true. Returns
 * the new commit's sha, or null when no commit was made (commits disabled,
 * git failure, or no-op step that touched only gitignored paths).
 */
export async function commitMigrationIfRequested(
  root: string,
  migration: { name: string },
  shouldCreateCommits: boolean,
  commitPrefix: string,
  installDepsIfChanged: () => Promise<void>
): Promise<string | null> {
  if (!shouldCreateCommits) return null;
  await installDepsIfChanged();
  const commitMessage = `${commitPrefix}${migration.name}`;
  // See file-level note: compare HEAD before vs after to detect a real commit.
  // Otherwise we'd report `Committed as <priorSha>` for a no-op step.
  const before = getLatestCommitSha(root);
  let after: string | null = null;
  try {
    after = commitChanges(commitMessage, root);
  } catch (e: any) {
    logger.info(pc.red(e.message));
    return null;
  }
  if (after && after !== before) {
    return after;
  }
  logger.info(
    pc.red(`A commit could not be created/retrieved for an unknown reason`)
  );
  return null;
}

/**
 * Commits any pre-existing working-tree state into a dedicated "checkpoint"
 * commit before the first migration runs. Without this, the first migration's
 * commit would absorb whatever was already pending — most commonly the
 * package.json edit `nx migrate latest` produces and the lockfile churn from
 * the orchestrator's `npm install --ignore-scripts` step — and migration 1's
 * validation would see that mixed in with the generator output. No-op when
 * the working tree is already clean.
 */
export function commitCheckpointBeforeMigrations(
  root: string,
  commitPrefix: string
): void {
  if (!hasUncommittedChanges(root)) return;
  // See file-level note: compare HEAD before vs after to detect a real commit.
  // Otherwise we'd falsely log a checkpoint and migration 1 would absorb the
  // pre-existing state, defeating the point.
  const before = getLatestCommitSha(root);
  let after: string | null = null;
  let thrown: unknown;
  try {
    after = commitChanges(
      `${commitPrefix}checkpoint before running migrations`,
      root
    );
  } catch (e) {
    thrown = e;
  }
  if (after && after !== before) {
    logger.info(pc.dim(`- Checkpoint commit created: ${after}`));
    return;
  }
  const reason = thrown instanceof Error ? thrown.message : undefined;
  output.warn({
    title: 'Could not create checkpoint commit before migrations',
    bodyLines: [
      ...(reason
        ? [reason]
        : [
            'The commit produced no new HEAD. Check that `user.email` / `user.name` are configured and that commit hooks are not rejecting the commit.',
          ]),
      `Migration 1's commit will absorb any pre-existing working-tree state.`,
    ],
  });
}
