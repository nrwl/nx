import {
  getLatestCommitSha,
  isAncestorCommit,
  resetWorkingTree,
} from '../../../utils/git-utils';
import { MIGRATE_RUNS_RELATIVE_DIR } from '../agentic/types';
import { warnToAgent } from './agent-output';
import {
  archiveIssues,
  reopenResolutionsForStep,
  warnReconstructedArchives,
  type IssueArchiveUpdate,
} from './issues';
import type {
  MigrateCommitLedgerEntry,
  MigrateRunState,
  MigrateStep,
} from './run-state';
import { updateRunState } from './state-lock';
import {
  coveringLandedEntries,
  discardGeneratorRun,
  hasPendingCommitDebt,
} from './state-machine';
import { summarizeError } from './util';

// A clean retry resets the tree to the step's captured pre-migration ref.
// That is only safe when every prior diff is already committed: without
// per-migration commits the ref is the run's starting commit (the reset would
// wipe all prior steps' uncommitted work); a failed init checkpoint or a
// pending step commit means the ref predates diffs the reset would also
// destroy; without a captured ref there is nothing to reset to; edits already
// in the tree when this step was dispensed (the user's own, or an earlier
// step's the checkpoint never saw) are not represented by the ref either; and
// HEAD anywhere other than the ref means something was committed since the
// step was dispensed that the reset would discard, whether that is this step's
// own commit (recorded, or made in the window before the worker died writing
// its ledger entry) or one the user made alongside the run.
// Cleanliness and position both have to say so explicitly: a failed tree probe
// records dirty, a run created before that field existed carries nothing to
// check, and an unreadable HEAD is no ref at all, so none of the three can be
// read as a restore point that exists.
// The debt check is run-wide: a clean retry resets and cleans the whole tree,
// which would discard every other failed step's uncommitted work as well.
export function canOfferCleanRetry(
  root: string,
  state: MigrateRunState,
  step: MigrateStep,
  head: string | null
): boolean {
  return (
    state.createCommits &&
    !state.checkpointFailed &&
    !hasPendingCommitDebt(state) &&
    !!step.gitRefBefore &&
    head === step.gitRefBefore &&
    step.treeCleanAtDispense === true &&
    !endangeredLandedEntry(root, state, step)
  );
}

// The last landed ledger entry covering the step whose commit a reset to the
// step's gitRefBefore would discard. Entries from earlier attempts predate the
// ref re-captured at re-dispense and survive the reset; only a commit that is
// not an ancestor of the ref (or cannot be verified as one) is endangered.
function endangeredLandedEntry(
  root: string,
  state: MigrateRunState,
  step: MigrateStep
): MigrateCommitLedgerEntry | null {
  let endangered: MigrateCommitLedgerEntry | null = null;
  for (const entry of coveringLandedEntries(state, step.id)) {
    if (
      !entry.sha ||
      !step.gitRefBefore ||
      !isAncestorCommit(entry.sha, step.gitRefBefore, root)
    ) {
      endangered = entry;
    }
  }
  return endangered;
}

// Explains why retry-clean is withheld for a failed or died step; feeds the
// death dispense and a rejected --step-action=retry-clean.
export function cleanRetryUnavailableReason(
  root: string,
  state: MigrateRunState,
  step: MigrateStep,
  head: string | null
): string {
  const endangered = endangeredLandedEntry(root, state, step);
  if (endangered) {
    return endangered.sha
      ? `this migration's changes already landed in commit ${endangered.sha}, which a reset would discard.`
      : `this migration's changes already landed in a commit, which a reset would discard.`;
  }
  if (step.gitRefBefore && head !== step.gitRefBefore) {
    return `HEAD is at ${head ?? '(unreadable)'} rather than the ${
      step.gitRefBefore
    } this migration started from, so a reset would discard what was committed in between.`;
  }
  return `resetting the tree could discard uncommitted work that no restore point accounts for.`;
}

// Best-effort: run.json records the reverted dispositions and stays
// authoritative, so a failed append loses only the archive's trail record of
// the revert. The sink survives a throw: a shell rebuilt before the failure
// is durable and reads healthy on retry, so this pass must warn it.
function archiveReopenedResolutions(
  dir: string,
  state: MigrateRunState,
  updates: IssueArchiveUpdate[],
  migrationId: string
): void {
  if (updates.length === 0) return;
  const reconstructedIds: string[] = [];
  try {
    archiveIssues(dir, { state, newIssues: [], updates }, reconstructedIds);
  } catch (e) {
    warnToAgent({
      title: `The reverted issue resolutions for ${migrationId} could not be archived (${summarizeError(e)}).`,
      bodyLines: [
        `run.json stays authoritative for the dispositions; the archived files under the run's issues directory miss the revert records, so their last entries may still read resolved.`,
      ],
    });
  }
  warnReconstructedArchives(reconstructedIds);
}

/**
 * The reset a clean retry of `stepId` needs, run with the tree reserved. The
 * retry is re-checked against the state read then, and the attempt's
 * generator run and the fixes its resolutions claimed are forgotten in a
 * write of their own before git runs, so a reset that fails midway leaves
 * the plain retry gated. Throws the reason when the retry is no longer
 * available, or what git said when the reset fails.
 */
export function resetForCleanRetry(
  root: string,
  dir: string,
  stepId: string
): void {
  const head = getLatestCommitSha(root);
  let step: MigrateStep | undefined;
  let updates: IssueArchiveUpdate[] = [];
  const prepared = updateRunState(dir, (fresh) => {
    step = fresh.steps.find((s) => s.id === stepId);
    if (!step) throw new Error(`step '${stepId}' is not in the run.`);
    if (!canOfferCleanRetry(root, fresh, step, head)) {
      throw new Error(cleanRetryUnavailableReason(root, fresh, step, head));
    }
    const reopened = reopenResolutionsForStep(
      discardGeneratorRun(fresh, stepId),
      stepId
    );
    updates = reopened.updates;
    return reopened.state;
  });
  archiveReopenedResolutions(dir, prepared, updates, step.migrationId);
  resetWorkingTree(step.gitRefBefore, [MIGRATE_RUNS_RELATIVE_DIR], root);
}
